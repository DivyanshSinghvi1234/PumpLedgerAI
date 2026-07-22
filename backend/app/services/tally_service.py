from __future__ import annotations

import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.voucher import Voucher
from app.models.payment import Payment
from app.core.enums import VerificationStatus, TallyStatus, FuelType, PaymentMode
from app.schemas.tally import TallyExportRequest, TallyPreviewResponse
from app.schemas.voucher import VoucherResponse
from app.schemas.payment import PaymentResponse


class TallyService:
    def get_pending_items(
        self,
        db: Session,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> tuple[list[Voucher], list[Payment]]:
        """
        Fetch verified vouchers and customer payments that are not yet synced to Tally.
        """
        # Vouchers: Must be VERIFIED, not SYNCED, and active.
        voucher_query = db.query(Voucher).options(
            joinedload(Voucher.customer),
            joinedload(Voucher.vehicle),
            selectinload(Voucher.items),
        ).filter(
            Voucher.verification_status == VerificationStatus.VERIFIED,
            Voucher.tally_status != TallyStatus.SYNCED,
            Voucher.is_active == True,
        )
        if from_date:
            voucher_query = voucher_query.filter(Voucher.invoice_date >= from_date)
        if to_date:
            voucher_query = voucher_query.filter(Voucher.invoice_date <= to_date)
        vouchers = voucher_query.order_by(Voucher.invoice_date.asc(), Voucher.invoice_number.asc()).all()

        # Payments: Must be not SYNCED and active.
        payment_query = db.query(Payment).options(joinedload(Payment.customer)).filter(
            Payment.tally_status != TallyStatus.SYNCED,
            Payment.is_active == True,
        )
        if from_date:
            payment_query = payment_query.filter(Payment.payment_date >= from_date)
        if to_date:
            payment_query = payment_query.filter(Payment.payment_date <= to_date)
        payments = payment_query.order_by(Payment.payment_date.asc(), Payment.created_at.asc()).all()

        return vouchers, payments

    def preview_export(
        self,
        db: Session,
        req: TallyExportRequest,
    ) -> TallyPreviewResponse:
        """
        Build preview data and warning messages before executing the Tally XML export.
        """
        vouchers, payments = self.get_pending_items(db, req.from_date, req.to_date)

        warnings = []
        total_sales_amount = Decimal("0.00")
        total_receipts_amount = Decimal("0.00")

        # Process Vouchers
        preview_vouchers = []
        for v in vouchers:
            total_sales_amount += v.total_amount
            preview_vouchers.append(VoucherResponse.model_validate(v))

            # Warnings validation
            if v.payment_mode == PaymentMode.CREDIT and v.customer_id is None:
                warnings.append(
                    f"Voucher {v.invoice_number} ({v.invoice_date}): "
                    f"CREDIT sale has no linked customer account. It will default to "
                    f"'{v.customer_name or 'Credit Customer'}' in Tally."
                )

        # Process Payments
        preview_payments = []
        for p in payments:
            total_receipts_amount += p.amount
            preview_payments.append(PaymentResponse.model_validate(p))

            if p.customer is None:
                warnings.append(
                    f"Payment of {p.amount} on {p.payment_date}: "
                    f"Has no linked customer ledger. Cannot export."
                )

        return TallyPreviewResponse(
            total_vouchers=len(vouchers),
            total_payments=len(payments),
            total_sales_amount=total_sales_amount,
            total_receipts_amount=total_receipts_amount,
            vouchers=preview_vouchers,
            payments=preview_payments,
            warnings=warnings,
        )

    def generate_xml(
        self,
        db: Session,
        req: TallyExportRequest,
    ) -> str:
        """
        Generate Tally ERP 9 / TallyPrime XML import package.
        """
        vouchers, payments = self.get_pending_items(db, req.from_date, req.to_date)

        # 1. Fetch active fuel tanks to build godown mapping
        from app.models.fuel_tank import FuelTank, TankerDelivery
        tanks = db.query(FuelTank).filter(FuelTank.is_active == True).all()
        godown_map = {}
        for t in tanks:
            if t.tally_godown_name:
                godown_map[t.fuel_type] = t.tally_godown_name

        # 2. Fetch bank deposits (Contra vouchers)
        from app.models.income import Income
        from app.core.enums import IncomeKind
        deposit_query = db.query(Income).filter(
            Income.kind == IncomeKind.DEPOSIT,
            Income.is_active == True
        )
        if req.from_date:
            deposit_query = deposit_query.filter(Income.income_date >= req.from_date)
        if req.to_date:
            deposit_query = deposit_query.filter(Income.income_date <= req.to_date)
        deposits = deposit_query.order_by(Income.income_date.asc(), Income.created_at.asc()).all()

        # 3. Fetch tanker deliveries (Purchase vouchers)
        delivery_query = db.query(TankerDelivery).options(joinedload(TankerDelivery.fuel_tank)).filter(
            TankerDelivery.is_active == True
        )
        if req.from_date:
            delivery_query = delivery_query.filter(TankerDelivery.delivery_date >= req.from_date)
        if req.to_date:
            delivery_query = delivery_query.filter(TankerDelivery.delivery_date <= req.to_date)
        deliveries = delivery_query.order_by(TankerDelivery.delivery_date.asc(), TankerDelivery.created_at.asc()).all()

        # Build XML structure
        envelope = ET.Element("ENVELOPE")
        
        header = ET.SubElement(envelope, "HEADER")
        tallyrequest = ET.SubElement(header, "TALLYREQUEST")
        tallyrequest.text = "Import Data"

        body = ET.SubElement(envelope, "BODY")
        importdata = ET.SubElement(body, "IMPORTDATA")
        
        reqdesc = ET.SubElement(importdata, "REQUESTDESC")
        reportname = ET.SubElement(reqdesc, "REPORTNAME")
        reportname.text = "Vouchers"
        
        reqdata = ET.SubElement(importdata, "REQUESTDATA")

        # Helpers to get ledger names from config mapping
        def get_sales_ledger(fuel_type: FuelType) -> str:
            if fuel_type == FuelType.PETROL:
                return req.ledger_mappings.petrol_sales_ledger
            elif fuel_type == FuelType.DIESEL:
                return req.ledger_mappings.diesel_sales_ledger
            else:
                return req.ledger_mappings.lubricant_sales_ledger

        def get_stock_item(fuel_type: FuelType) -> str:
            if fuel_type == FuelType.PETROL:
                return req.ledger_mappings.petrol_stock_item
            elif fuel_type == FuelType.DIESEL:
                return req.ledger_mappings.diesel_stock_item
            else:
                return req.ledger_mappings.lubricant_stock_item

        def get_supplier_ledger(fuel_type: FuelType) -> str:
            if fuel_type == FuelType.PETROL:
                return req.ledger_mappings.petrol_supplier_ledger
            elif fuel_type == FuelType.DIESEL:
                return req.ledger_mappings.diesel_supplier_ledger
            else:
                return req.ledger_mappings.lubricant_supplier_ledger

        def get_cash_bank_ledger(mode: PaymentMode) -> str:
            if mode == PaymentMode.CASH:
                return req.ledger_mappings.cash_ledger
            elif mode == PaymentMode.UPI:
                return req.ledger_mappings.upi_ledger
            elif mode == PaymentMode.CARD:
                return req.ledger_mappings.card_ledger
            return "Cash"

        # 1. Generate XML for Vouchers (Tally Sales Vouchers)
        for v in vouchers:
            tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
            v_element = ET.SubElement(tallymsg, "VOUCHER", {
                "ACTION": "Create",
                "VCHTYPE": req.voucher_types.sales
            })
            
            # Basic Header info
            date_str = v.invoice_date.strftime("%Y%m%d")
            ET.SubElement(v_element, "DATE").text = date_str
            ET.SubElement(v_element, "EFFECTIVEDATE").text = date_str
            ET.SubElement(v_element, "GUID").text = str(v.uuid)
            ET.SubElement(v_element, "VOUCHERNUMBER").text = v.invoice_number
            ET.SubElement(v_element, "VOUCHERTYPENAME").text = req.voucher_types.sales
            
            # Party ledger selection
            if v.payment_mode == PaymentMode.CREDIT:
                party_ledger = v.customer.name if v.customer else (v.customer_name or "Credit Customer")
            else:
                party_ledger = get_cash_bank_ledger(v.payment_mode)
            
            ET.SubElement(v_element, "PARTYLEDGERNAME").text = party_ledger
            ET.SubElement(v_element, "PERSISTEDVIEW").text = "Accounting Voucher"
            
            if v.items:
                item_remarks = [f"{item.fuel_type.value}: {item.quantity_liters}L @ {item.rate_per_liter}" for item in v.items]
                remarks_parts = [f"Items: {', '.join(item_remarks)}"]
            else:
                remarks_parts = [f"Fuel: {v.fuel_type.value if v.fuel_type else ''} @ {v.rate_per_liter}/L x {v.quantity_liters}L"]

            if v.vehicle_number:
                remarks_parts.append(f"Vehicle: {v.vehicle_number}")
            if v.remarks:
                remarks_parts.append(v.remarks)
            ET.SubElement(v_element, "NARRATION").text = " | ".join(remarks_parts)

            # --- ALLLEDGERENTRIES.LIST ---
            v_total = v.total_amount if v.total_amount is not None else Decimal("0.00")
            # Entry 1: Party Debit (positive amount represents DEBIT in Tally XML but uses negative number for value)
            party_entry = ET.SubElement(v_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(party_entry, "LEDGERNAME").text = party_ledger
            ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "Yes" # YES = Debit
            ET.SubElement(party_entry, "AMOUNT").text = f"-{v_total:.2f}" # Debit value is negative in Tally XML

            # Entry 2: Sales Credit
            if not req.export_inventory:
                # Accounting-Only Format
                if v.items:
                    for item in v.items:
                        item_total = item.total_amount if item.total_amount is not None else Decimal("0.00")
                        sales_ledger = get_sales_ledger(item.fuel_type)
                        sales_entry = ET.SubElement(v_element, "ALLLEDGERENTRIES.LIST")
                        ET.SubElement(sales_entry, "LEDGERNAME").text = sales_ledger
                        ET.SubElement(sales_entry, "ISDEEMEDPOSITIVE").text = "No" # NO = Credit
                        ET.SubElement(sales_entry, "AMOUNT").text = f"{item_total:.2f}"
                else:
                    sales_ledger = get_sales_ledger(v.fuel_type)
                    sales_entry = ET.SubElement(v_element, "ALLLEDGERENTRIES.LIST")
                    ET.SubElement(sales_entry, "LEDGERNAME").text = sales_ledger
                    ET.SubElement(sales_entry, "ISDEEMEDPOSITIVE").text = "No" # NO = Credit
                    ET.SubElement(sales_entry, "AMOUNT").text = f"{v_total:.2f}"
            else:
                # Full Inventory Stock Sync Format
                if v.items:
                    for item in v.items:
                        stock_item = get_stock_item(item.fuel_type)
                        sales_ledger = get_sales_ledger(item.fuel_type)
                        godown_name = godown_map.get(item.fuel_type)
                        
                        item_rate = item.rate_per_liter if item.rate_per_liter is not None else Decimal("0.00")
                        item_qty = item.quantity_liters if item.quantity_liters is not None else Decimal("0.00")
                        item_total = item.total_amount if item.total_amount is not None else Decimal("0.00")

                        inv_entry = ET.SubElement(v_element, "ALLINVENTORYENTRIES.LIST")
                        ET.SubElement(inv_entry, "STOCKITEMNAME").text = stock_item
                        ET.SubElement(inv_entry, "ISDEEMEDPOSITIVE").text = "No"
                        ET.SubElement(inv_entry, "RATE").text = f"{item_rate:.2f}/LTRS"
                        ET.SubElement(inv_entry, "AMOUNT").text = f"{item_total:.2f}"
                        ET.SubElement(inv_entry, "ACTUALQTY").text = f"{item_qty:.2f} LTRS"
                        ET.SubElement(inv_entry, "BILLEDQTY").text = f"{item_qty:.2f} LTRS"
                        
                        if godown_name:
                            batch_entry = ET.SubElement(inv_entry, "BATCHALLOCATIONS.LIST")
                            ET.SubElement(batch_entry, "GODOWNNAME").text = godown_name
                            ET.SubElement(batch_entry, "BATCHNAME").text = "Primary"
                            ET.SubElement(batch_entry, "AMOUNT").text = f"{item_total:.2f}"
                            ET.SubElement(batch_entry, "ACTUALQTY").text = f"{item_qty:.2f} LTRS"
                            ET.SubElement(batch_entry, "BILLEDQTY").text = f"{item_qty:.2f} LTRS"
                        
                        acc_entry = ET.SubElement(inv_entry, "ACCOUNTINGALLOCATIONS.LIST")
                        ET.SubElement(acc_entry, "LEDGERNAME").text = sales_ledger
                        ET.SubElement(acc_entry, "ISDEEMEDPOSITIVE").text = "No"
                        ET.SubElement(acc_entry, "AMOUNT").text = f"{item_total:.2f}"
                else:
                    stock_item = get_stock_item(v.fuel_type)
                    sales_ledger = get_sales_ledger(v.fuel_type)
                    godown_name = godown_map.get(v.fuel_type)
                    
                    rate_val = v.rate_per_liter if v.rate_per_liter is not None else Decimal("0.00")
                    qty_val = v.quantity_liters if v.quantity_liters is not None else Decimal("0.00")
                    ET.SubElement(inv_entry, "RATE").text = f"{rate_val:.2f}/LTRS"
                    ET.SubElement(inv_entry, "AMOUNT").text = f"{v_total:.2f}"
                    ET.SubElement(inv_entry, "ACTUALQTY").text = f"{qty_val:.2f} LTRS"
                    ET.SubElement(inv_entry, "BILLEDQTY").text = f"{qty_val:.2f} LTRS"
                    
                    if godown_name:
                        batch_entry = ET.SubElement(inv_entry, "BATCHALLOCATIONS.LIST")
                        ET.SubElement(batch_entry, "GODOWNNAME").text = godown_name
                        ET.SubElement(batch_entry, "BATCHNAME").text = "Primary"
                        ET.SubElement(batch_entry, "AMOUNT").text = f"{v_total:.2f}"
                        ET.SubElement(batch_entry, "ACTUALQTY").text = f"{qty_val:.2f} LTRS"
                        ET.SubElement(batch_entry, "BILLEDQTY").text = f"{qty_val:.2f} LTRS"
                    
                    acc_entry = ET.SubElement(inv_entry, "ACCOUNTINGALLOCATIONS.LIST")
                    ET.SubElement(acc_entry, "LEDGERNAME").text = sales_ledger
                    ET.SubElement(acc_entry, "ISDEEMEDPOSITIVE").text = "No"
                    ET.SubElement(acc_entry, "AMOUNT").text = f"{v_total:.2f}"

        # 2. Generate XML for Payments (Tally Receipt Vouchers)
        for p in payments:
            if p.customer is None:
                continue

            tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
            p_element = ET.SubElement(tallymsg, "VOUCHER", {
                "ACTION": "Create",
                "VCHTYPE": req.voucher_types.receipt
            })
            
            date_str = p.payment_date.strftime("%Y%m%d")
            ET.SubElement(p_element, "DATE").text = date_str
            ET.SubElement(p_element, "EFFECTIVEDATE").text = date_str
            ET.SubElement(p_element, "GUID").text = str(p.uuid)
            ET.SubElement(p_element, "VOUCHERTYPENAME").text = req.voucher_types.receipt
            
            party_ledger = p.customer.name
            ET.SubElement(p_element, "PARTYLEDGERNAME").text = party_ledger
            ET.SubElement(p_element, "PERSISTEDVIEW").text = "Accounting Voucher"
            
            remarks_parts = [f"Payment mode: {p.payment_mode.value}"]
            if p.reference_number:
                remarks_parts.append(f"Ref: {p.reference_number}")
            if p.remarks:
                remarks_parts.append(p.remarks)
            ET.SubElement(p_element, "NARRATION").text = " | ".join(remarks_parts)

            # --- ALLLEDGERENTRIES.LIST ---
            # Entry 1: Cash/Bank Debit (positive amount in Tally terms, stored as negative)
            cash_bank_ledger = get_cash_bank_ledger(p.payment_mode)
            bank_entry = ET.SubElement(p_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(bank_entry, "LEDGERNAME").text = cash_bank_ledger
            ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "Yes" # YES = Debit
            ET.SubElement(bank_entry, "AMOUNT").text = f"-{p.amount:.2f}"

            # Entry 2: Customer Account Credit (negative amount in Tally terms, stored as positive)
            customer_entry = ET.SubElement(p_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(customer_entry, "LEDGERNAME").text = party_ledger
            ET.SubElement(customer_entry, "ISDEEMEDPOSITIVE").text = "No" # NO = Credit
            ET.SubElement(customer_entry, "AMOUNT").text = f"{p.amount:.2f}"

        # 3. Generate XML for Bank Deposits (Tally Contra Vouchers)
        for d in deposits:
            tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
            c_element = ET.SubElement(tallymsg, "VOUCHER", {
                "ACTION": "Create",
                "VCHTYPE": req.voucher_types.contra
            })
            
            date_str = d.income_date.strftime("%Y%m%d")
            ET.SubElement(c_element, "DATE").text = date_str
            ET.SubElement(c_element, "EFFECTIVEDATE").text = date_str
            ET.SubElement(c_element, "GUID").text = str(d.uuid)
            ET.SubElement(c_element, "VOUCHERTYPENAME").text = req.voucher_types.contra
            
            bank_ledger = get_cash_bank_ledger(d.payment_mode)
            cash_ledger = req.ledger_mappings.cash_ledger
            
            ET.SubElement(c_element, "PARTYLEDGERNAME").text = bank_ledger
            ET.SubElement(c_element, "PERSISTEDVIEW").text = "Accounting Voucher"
            ET.SubElement(c_element, "NARRATION").text = f"Bank Deposit: {d.description}"

            # Bank Debit
            bank_entry = ET.SubElement(c_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(bank_entry, "LEDGERNAME").text = bank_ledger
            ET.SubElement(bank_entry, "ISDEEMEDPOSITIVE").text = "Yes"
            ET.SubElement(bank_entry, "AMOUNT").text = f"-{d.amount:.2f}"

            # Cash Credit
            cash_entry = ET.SubElement(c_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(cash_entry, "LEDGERNAME").text = cash_ledger
            ET.SubElement(cash_entry, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(cash_entry, "AMOUNT").text = f"{d.amount:.2f}"

        # 4. Generate XML for Tanker Deliveries (Tally Purchase Vouchers)
        for td in deliveries:
            if not td.fuel_tank:
                continue
                
            tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})
            p_element = ET.SubElement(tallymsg, "VOUCHER", {
                "ACTION": "Create",
                "VCHTYPE": req.voucher_types.purchase
            })
            
            date_str = td.delivery_date.strftime("%Y%m%d")
            ET.SubElement(p_element, "DATE").text = date_str
            ET.SubElement(p_element, "EFFECTIVEDATE").text = date_str
            ET.SubElement(p_element, "GUID").text = str(td.uuid)
            ET.SubElement(p_element, "VOUCHERNUMBER").text = td.invoice_number or f"DEL-{td.id}"
            ET.SubElement(p_element, "VOUCHERTYPENAME").text = req.voucher_types.purchase
            
            supplier = td.supplier_name or get_supplier_ledger(td.fuel_tank.fuel_type)
            ET.SubElement(p_element, "PARTYLEDGERNAME").text = supplier
            ET.SubElement(p_element, "PERSISTEDVIEW").text = "Invoice mode"
            
            narration_parts = [f"Fuel delivery of {td.quantity_liters} L to {td.fuel_tank.name}"]
            if td.density:
                narration_parts.append(f"Density: {td.density}")
            if td.remarks:
                narration_parts.append(td.remarks)
            ET.SubElement(p_element, "NARRATION").text = " | ".join(narration_parts)

            # Purchase voucher contains stock items (Inventory purchase details)
            amount_val = Decimal("0.00") # Deliveries have no explicit invoice total on delivery sheet
            
            # Supplier Credit (CR)
            supplier_entry = ET.SubElement(p_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(supplier_entry, "LEDGERNAME").text = supplier
            ET.SubElement(supplier_entry, "ISDEEMEDPOSITIVE").text = "No"
            ET.SubElement(supplier_entry, "AMOUNT").text = f"{amount_val:.2f}"

            # Inventory Debit (DR)
            stock_item = get_stock_item(td.fuel_tank.fuel_type)
            purchase_ledger = get_supplier_ledger(td.fuel_tank.fuel_type)
            godown_name = godown_map.get(td.fuel_tank.fuel_type)
            
            inv_entry = ET.SubElement(p_element, "ALLINVENTORYENTRIES.LIST")
            ET.SubElement(inv_entry, "STOCKITEMNAME").text = stock_item
            ET.SubElement(inv_entry, "ISDEEMEDPOSITIVE").text = "Yes"
            ET.SubElement(inv_entry, "RATE").text = "0.00/LTRS"
            ET.SubElement(inv_entry, "AMOUNT").text = f"-{amount_val:.2f}"
            ET.SubElement(inv_entry, "ACTUALQTY").text = f"{td.quantity_liters:.2f} LTRS"
            ET.SubElement(inv_entry, "BILLEDQTY").text = f"{td.quantity_liters:.2f} LTRS"
            
            if godown_name:
                batch_entry = ET.SubElement(inv_entry, "BATCHALLOCATIONS.LIST")
                ET.SubElement(batch_entry, "GODOWNNAME").text = godown_name
                ET.SubElement(batch_entry, "BATCHNAME").text = "Primary"
                ET.SubElement(batch_entry, "AMOUNT").text = f"-{amount_val:.2f}"
                ET.SubElement(batch_entry, "ACTUALQTY").text = f"{td.quantity_liters:.2f} LTRS"
                ET.SubElement(batch_entry, "BILLEDQTY").text = f"{td.quantity_liters:.2f} LTRS"
                
            acc_entry = ET.SubElement(inv_entry, "ACCOUNTINGALLOCATIONS.LIST")
            ET.SubElement(acc_entry, "LEDGERNAME").text = purchase_ledger
            ET.SubElement(acc_entry, "ISDEEMEDPOSITIVE").text = "Yes"
            ET.SubElement(acc_entry, "AMOUNT").text = f"-{amount_val:.2f}"

        # Convert element tree to formatted string
        xml_str = ET.tostring(envelope, encoding="utf-8")
        
        # Prettify XML
        parsed = minidom.parseString(xml_str)
        return parsed.toprettyxml(indent="  ")

    def mark_as_synced(
        self,
        db: Session,
        voucher_uuids: list[str],
        payment_uuids: list[str],
    ) -> None:
        """
        Mark vouchers and payments as SYNCED to Tally.
        """
        if voucher_uuids:
            db.query(Voucher).filter(Voucher.uuid.in_(voucher_uuids)).update(
                {"tally_status": TallyStatus.SYNCED},
                synchronize_session=False
            )
        
        if payment_uuids:
            db.query(Payment).filter(Payment.uuid.in_(payment_uuids)).update(
                {"tally_status": TallyStatus.SYNCED},
                synchronize_session=False
            )
        
        db.commit()

    def import_xml_data(
        self,
        db: Session,
        xml_content: bytes,
    ) -> TallyImportResponse:
        import time
        import re
        import unicodedata
        from datetime import datetime
        from app.models.customer import Customer
        from app.models.voucher import Voucher
        from app.models.voucher_item import VoucherItem
        from app.models.payment import Payment
        from app.core.enums import FuelType, PaymentMode, TallyStatus, VerificationStatus, PaymentStatus
        from app.schemas.tally import TallyImportResponse, ImportWarning
        from sqlalchemy import func
        
        start_time = time.time()
        
        # Phase 0: Validation
        warnings = []
        customers_imported = 0
        vouchers_imported = 0
        payments_imported = 0
        customers_skipped = 0
        vouchers_skipped = 0
        duplicates_found = 0
        parse_errors = 0

        def add_warning(w_type: str, msg: str, v_num: str | None = None):
            warnings.append(ImportWarning(type=w_type, message=msg, voucher_number=v_num))

        try:
            root = ET.fromstring(xml_content)
        except ET.ParseError as e:
            raise ValueError(f"XML parsing failed: The file is not a well-formed XML document. Details: {str(e)}")

        # Auto-detect Tally structure and normalize
        ledgers = root.findall(".//LEDGER")
        vouchers = root.findall(".//VOUCHER")

        if not ledgers and not vouchers:
            # Try finding elements using local name matching (namespace tolerance)
            ledgers = [elem for elem in root.iter() if elem.tag.split('}')[-1] == "LEDGER"]
            vouchers = [elem for elem in root.iter() if elem.tag.split('}')[-1] == "VOUCHER"]

        # Cache active customers to prevent redundant DB calls
        def get_normalized_name(n: str) -> str:
            return unicodedata.normalize('NFKC', n.strip()).lower()

        customer_cache = {get_normalized_name(c.name): c for c in db.query(Customer).filter(Customer.is_active == True).all()}

        # Phase 1: Import Masters (Ledgers under Sundry Debtors)
        for led in ledgers:
            try:
                parent = led.findtext("PARENT") or ""
                if not parent:
                    parent = led.attrib.get("PARENT") or ""
                
                if "sundry debtors" in parent.lower().strip():
                    name = led.findtext("NAME") or led.attrib.get("NAME") or ""
                    if not name:
                        name_elem = led.find(".//NAME")
                        if name_elem is not None:
                            name = name_elem.text or ""
                    
                    if not name:
                        continue
                    
                    norm_name = get_normalized_name(name)
                    if norm_name in customer_cache:
                        customers_skipped += 1
                        continue
                    
                    # Parse opening balance
                    opening_bal_str = led.findtext("OPENINGBALANCE") or "0.00"
                    try:
                        opening_bal = abs(Decimal(opening_bal_str.strip()))
                    except Exception:
                        opening_bal = Decimal("0.00")
                        
                    # Create new customer
                    cust = Customer(
                        name=name.strip(),
                        opening_balance=opening_bal,
                        outstanding_balance=opening_bal,
                    )
                    db.add(cust)
                    db.commit()
                    db.refresh(cust)
                    
                    customer_cache[norm_name] = cust
                    customers_imported += 1
            except Exception as e:
                parse_errors += 1
                add_warning("Master Import Error", f"Failed to import ledger: {str(e)}")

        # Phase 2: Import Transactions (Vouchers)
        for v_elem in vouchers:
            v_num = v_elem.findtext("VOUCHERNUMBER") or v_elem.attrib.get("VOUCHERNUMBER") or ""
            try:
                vch_type = v_elem.attrib.get("VCHTYPE") or v_elem.findtext("VOUCHERTYPENAME") or ""
                
                date_str = v_elem.findtext("DATE") or ""
                if not date_str and v_elem.attrib.get("DATE"):
                    date_str = v_elem.attrib.get("DATE") or ""
                
                if not date_str:
                    parse_errors += 1
                    add_warning("Invalid Date", "Skipping voucher with missing date.", v_num)
                    vouchers_skipped += 1
                    continue
                
                try:
                    vch_date = datetime.strptime(date_str.strip(), "%Y%m%d").date()
                except ValueError:
                    parse_errors += 1
                    add_warning("Invalid Date", f"Failed to parse date string '{date_str}'.", v_num)
                    vouchers_skipped += 1
                    continue

                # Locate all ledger entries (support ERP 9 & Prime tag names)
                entries = v_elem.findall(".//ALLLEDGERENTRIES.LIST") + v_elem.findall(".//LEDGERENTRIES.LIST")
                if not entries:
                    entries = [elem for elem in v_elem.iter() if elem.tag.split('}')[-1] in ("ALLLEDGERENTRIES.LIST", "LEDGERENTRIES.LIST")]

                if not entries:
                    parse_errors += 1
                    add_warning("Missing Entries", "Voucher has no ledger entries.", v_num)
                    vouchers_skipped += 1
                    continue

                # Resolve customer name and verify entries details
                resolved_cust = None
                debit_ledger = None
                credit_ledger = None
                total_amt = Decimal("0.00")
                
                for entry in entries:
                    ledger_name = entry.findtext("LEDGERNAME") or ""
                    if not ledger_name:
                        ledger_name = entry.attrib.get("LEDGERNAME") or ""
                    
                    if not ledger_name:
                        continue
                    
                    amt_str = entry.findtext("AMOUNT") or "0.00"
                    try:
                        amt = abs(Decimal(amt_str.strip()))
                    except Exception:
                        amt = Decimal("0.00")
                        
                    is_deemed_positive = (entry.findtext("ISDEEMEDPOSITIVE") or "").lower().strip() == "yes"
                    
                    norm_led = get_normalized_name(ledger_name)
                    if norm_led in customer_cache:
                        resolved_cust = customer_cache[norm_led]
                    
                    if is_deemed_positive:
                        debit_ledger = ledger_name
                        total_amt = amt
                    else:
                        credit_ledger = ledger_name

                if not resolved_cust:
                    vouchers_skipped += 1
                    continue

                narration = v_elem.findtext("NARRATION") or ""
                
                # Check for Duplicates
                if "sales" in vch_type.lower():
                    if not v_num:
                        v_num = f"TALLY-{date_str}-{total_amt:.0f}"
                        
                    exists = db.query(Voucher).filter_by(invoice_number=v_num, invoice_date=vch_date).first()
                    if exists:
                        duplicates_found += 1
                        vouchers_skipped += 1
                        add_warning("Duplicate Voucher", f"Voucher '{v_num}' on {vch_date} already exists.", v_num)
                        continue

                    # Item Extraction Priority
                    items_list = []
                    
                    inv_entries = v_elem.findall(".//ALLINVENTORYENTRIES.LIST") + v_elem.findall(".//INVENTORYENTRIES.LIST")
                    if not inv_entries:
                        inv_entries = [elem for elem in v_elem.iter() if elem.tag.split('}')[-1] in ("ALLINVENTORYENTRIES.LIST", "INVENTORYENTRIES.LIST")]

                    for inv in inv_entries:
                        stock_name = inv.findtext("STOCKITEMNAME") or ""
                        rate_str = inv.findtext("RATE") or ""
                        qty_str = inv.findtext("ACTUALQTY") or inv.findtext("BILLEDQTY") or ""
                        item_amt_str = inv.findtext("AMOUNT") or "0.00"
                        
                        f_type = FuelType.LUBRICANT
                        if "petrol" in stock_name.lower() or "ms" in stock_name.lower():
                            f_type = FuelType.PETROL
                        elif "diesel" in stock_name.lower() or "hsd" in stock_name.lower():
                            f_type = FuelType.DIESEL
                        elif "speed" in stock_name.lower():
                            f_type = FuelType.SPEED
                            
                        qty = Decimal("0.00")
                        if qty_str:
                            qty_match = re.search(r"([0-9.]+)", qty_str)
                            if qty_match:
                                qty = Decimal(qty_match.group(1))
                        
                        rate = Decimal("0.00")
                        if rate_str:
                            rate_match = re.search(r"([0-9.]+)", rate_str)
                            if rate_match:
                                rate = Decimal(rate_match.group(1))
                                
                        try:
                            item_amt = abs(Decimal(item_amt_str.strip()))
                        except Exception:
                            item_amt = qty * rate
                            
                        items_list.append({
                            "fuel_type": f_type,
                            "quantity_liters": qty,
                            "rate_per_liter": rate,
                            "total_amount": item_amt
                        })

                    veh_num = None
                    main_fuel = FuelType.PETROL
                    main_qty = Decimal("0.00")
                    main_rate = Decimal("0.00")
                    
                    if narration:
                        veh_match = re.search(r"(?:vehicle|veh|no):?\s*([a-zA-Z0-9-]{4,15})", narration, re.IGNORECASE)
                        if veh_match:
                            veh_num = veh_match.group(1).upper().strip()
                        
                        if not items_list:
                            qty_match = re.search(r"([0-9.]+)\s*(?:l|ltr|liters)", narration, re.IGNORECASE)
                            if qty_match:
                                main_qty = Decimal(qty_match.group(1))
                                
                            rate_match = re.search(r"@\s*([0-9.]+)", narration)
                            if rate_match:
                                main_rate = Decimal(rate_match.group(1))
                                
                            if "diesel" in narration.lower():
                                main_fuel = FuelType.DIESEL
                            elif "speed" in narration.lower():
                                main_fuel = FuelType.SPEED

                    pay_mode = PaymentMode.CREDIT
                    if debit_ledger and resolved_cust.name != debit_ledger:
                        pay_mode = PaymentMode.CASH
                        if "upi" in debit_ledger.lower():
                            pay_mode = PaymentMode.UPI
                        elif "card" in debit_ledger.lower() or "bank" in debit_ledger.lower():
                            pay_mode = PaymentMode.CARD

                    with db.begin_nested():
                        voucher = Voucher(
                            invoice_number=v_num,
                            invoice_date=vch_date,
                            customer_id=resolved_cust.id,
                            customer_name=resolved_cust.name,
                            vehicle_number=veh_num,
                            total_amount=total_amt,
                            payment_mode=pay_mode,
                            amount_paid=total_amt if pay_mode != PaymentMode.CREDIT else Decimal("0.00"),
                            payment_status=PaymentStatus.PAID if pay_mode != PaymentMode.CREDIT else PaymentStatus.UNPAID,
                            verification_status=VerificationStatus.VERIFIED,
                            tally_status=TallyStatus.SYNCED,
                            remarks=narration or f"Imported from Tally Daybook",
                        )
                        
                        if items_list:
                            for it in items_list:
                                v_item = VoucherItem(
                                    fuel_type=it["fuel_type"],
                                    quantity_liters=it["quantity_liters"],
                                    rate_per_liter=it["rate_per_liter"],
                                    total_amount=it["total_amount"]
                                )
                                voucher.items.append(v_item)
                            voucher.fuel_type = items_list[0]["fuel_type"]
                            voucher.quantity_liters = items_list[0]["quantity_liters"]
                            voucher.rate_per_liter = items_list[0]["rate_per_liter"]
                        else:
                            voucher.fuel_type = main_fuel
                            voucher.quantity_liters = main_qty
                            voucher.rate_per_liter = main_rate
                            
                        db.add(voucher)
                    
                    db.commit()
                    vouchers_imported += 1

                elif "receipt" in vch_type.lower():
                    ref_val = v_elem.findtext("BILLALLOCATIONS.LIST/BILLNO") or v_num or ""
                    exists_pmt = db.query(Payment).filter_by(
                        customer_id=resolved_cust.id,
                        payment_date=vch_date,
                        amount=total_amt,
                        reference_number=ref_val if ref_val else None
                    ).first()
                    
                    if exists_pmt:
                        duplicates_found += 1
                        vouchers_skipped += 1
                        add_warning("Duplicate Receipt", f"Receipt of ₹{total_amt:.2f} on {vch_date} already exists.", v_num)
                        continue
                        
                    pay_mode = PaymentMode.CASH
                    if debit_ledger and "upi" in debit_ledger.lower():
                        pay_mode = PaymentMode.UPI
                    elif debit_ledger and ("card" in debit_ledger.lower() or "bank" in debit_ledger.lower()):
                        pay_mode = PaymentMode.CARD

                    with db.begin_nested():
                        pmt = Payment(
                            customer_id=resolved_cust.id,
                            amount=total_amt,
                            payment_mode=pay_mode,
                            payment_date=vch_date,
                            reference_number=ref_val or None,
                            remarks=narration or f"Imported receipt from Tally",
                            tally_status=TallyStatus.SYNCED
                        )
                        db.add(pmt)
                    
                    db.commit()
                    payments_imported += 1
                    
            except Exception as e:
                db.rollback()
                parse_errors += 1
                add_warning("Voucher Parse Failure", f"Failed to import voucher: {str(e)}", v_num)
                vouchers_skipped += 1

        duration = int((time.time() - start_time) * 1000)
        
        return TallyImportResponse(
            customers_imported=customers_imported,
            vouchers_imported=vouchers_imported,
            payments_imported=payments_imported,
            customers_skipped=customers_skipped,
            vouchers_skipped=vouchers_skipped,
            duplicates_found=duplicates_found,
            parse_errors=parse_errors,
            duration_ms=duration,
            warnings=warnings
        )
