from __future__ import annotations

import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload

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
        voucher_query = db.query(Voucher).options(joinedload(Voucher.customer)).filter(
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

        # Build XML structure
        envelope = ET.Element("ENVELOPE")
        
        header = ET.SubElement(envelope, "HEADER")
        tallyrequest = ET.SubElement(header, "TALLYREQUEST")
        tallyrequest.text = "Import"

        body = ET.SubElement(envelope, "BODY")
        importdata = ET.SubElement(body, "IMPORTDATA")
        
        reqdesc = ET.SubElement(importdata, "REQUESTDESC")
        reportname = ET.SubElement(reqdesc, "REPORTNAME")
        reportname.text = "Vouchers"
        
        reqdata = ET.SubElement(importdata, "REQUESTDATA")
        tallymsg = ET.SubElement(reqdata, "TALLYMESSAGE", {"xmlns:UDF": "TallyUDF"})

        # Helpers to get ledger names from config mapping
        def get_sales_ledger(fuel_type: FuelType) -> str:
            if fuel_type == FuelType.PETROL:
                return req.ledger_mappings.petrol_sales_ledger
            elif fuel_type == FuelType.DIESEL:
                return req.ledger_mappings.diesel_sales_ledger
            else:
                return req.ledger_mappings.lubricant_sales_ledger

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
            
            remarks_parts = [f"Fuel: {v.fuel_type.value} @ {v.rate_per_liter}/L x {v.quantity_liters}L"]
            if v.vehicle_number:
                remarks_parts.append(f"Vehicle: {v.vehicle_number}")
            if v.remarks:
                remarks_parts.append(v.remarks)
            ET.SubElement(v_element, "NARRATION").text = " | ".join(remarks_parts)

            # --- ALLLEDGERENTRIES.LIST ---
            # Entry 1: Party Debit (positive amount represents DEBIT in Tally XML but uses negative number for value)
            party_entry = ET.SubElement(v_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(party_entry, "LEDGERNAME").text = party_ledger
            ET.SubElement(party_entry, "ISDEEMEDPOSITIVE").text = "Yes" # YES = Debit
            ET.SubElement(party_entry, "AMOUNT").text = f"-{v.total_amount:.2f}" # Debit value is negative in Tally XML

            # Entry 2: Sales Credit (negative amount represents CREDIT in Tally XML but uses positive number for value)
            sales_ledger = get_sales_ledger(v.fuel_type)
            sales_entry = ET.SubElement(v_element, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(sales_entry, "LEDGERNAME").text = sales_ledger
            ET.SubElement(sales_entry, "ISDEEMEDPOSITIVE").text = "No" # NO = Credit
            ET.SubElement(sales_entry, "AMOUNT").text = f"{v.total_amount:.2f}" # Credit value is positive in Tally XML

        # 2. Generate XML for Payments (Tally Receipt Vouchers)
        for p in payments:
            if p.customer is None:
                continue

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
