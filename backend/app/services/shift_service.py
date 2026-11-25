from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.shift import Shift
from app.models.shift_settlement import ShiftSettlement
from app.models.voucher import Voucher
from app.models.employee import Employee
from app.repositories.shift_repository import ShiftRepository
from app.core.enums import IncomeKind, PaymentMode
from app.schemas.shift import (
    SettlementNozzleDefault,
    ShiftSettlementCreate,
    ShiftSettlementDefaultsResponse,
)
from app.services.audit_log_service import AuditLogService


class ShiftService:

    def __init__(self):
        self.repository = ShiftRepository()
        self.audit_service = AuditLogService()

    def start_shift(
        self,
        db: Session,
        employee_uuid: str,
        opening_cash: Decimal | float,
        actor_id: int | None = None,
    ) -> Shift:
        # Resolve employee
        employee = db.scalar(select(Employee).where(Employee.uuid == employee_uuid))
        if not employee:
            raise ValueError("Employee not found.")

        # Check if there is already an active shift
        active = self.repository.get_active_shift(db)
        if active:
            raise ValueError(f"Attendant '{active.employee.full_name}' already has an active shift open.")

        shift = Shift(
            employee_id=employee.id,
            opening_cash=Decimal(str(opening_cash)),
            cash_reconciled=False,
        )
        shift = self.repository.create(db, shift)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Started Shift",
            target_table="shifts",
            target_id=str(shift.id),
            actor_id=actor_id,
            new_values={
                "employee_id": str(employee.id),
                "employee_name": employee.full_name,
                "opening_cash": str(opening_cash),
            }
        )
        return shift

    def get_active_shift(self, db: Session) -> Shift | None:
        return self.repository.get_active_shift(db)

    def end_shift(
        self,
        db: Session,
        closing_cash_reported: Decimal | float,
        actor_id: int | None = None,
    ) -> Shift:
        # Get active shift
        shift = self.repository.get_active_shift(db)
        if not shift:
            raise ValueError("No active shift found to end.")

        old_values = {
            "start_time": str(shift.start_time),
            "opening_cash": str(shift.opening_cash),
            "cash_reconciled": shift.cash_reconciled,
        }

        end_time = datetime.now(timezone.utc).replace(tzinfo=None)
        shift.end_time = end_time

        # 1. Query total sales during this shift (active vouchers created within start_time and end_time)
        sales_total = db.scalar(
            select(func.sum(Voucher.total_amount))
            .where(
                func.datetime(Voucher.created_at) >= func.datetime(shift.start_time),
                func.datetime(Voucher.created_at) <= func.datetime(end_time),
                Voucher.is_active == True
            )
        ) or Decimal("0.00")

        shift.total_sales_amount = sales_total

        # 2. Query expected cash (opening_cash + cash sales vouchers during this shift)
        cash_sales = db.scalar(
            select(func.sum(Voucher.total_amount))
            .where(
                func.datetime(Voucher.created_at) >= func.datetime(shift.start_time),
                func.datetime(Voucher.created_at) <= func.datetime(end_time),
                Voucher.payment_mode == PaymentMode.CASH,
                Voucher.is_active == True
            )
        ) or Decimal("0.00")

        expected_cash = shift.opening_cash + cash_sales
        reported_cash = Decimal(str(closing_cash_reported))
        shift.closing_cash_reported = reported_cash

        # 3. Variance = reported - expected
        shift.variance = reported_cash - expected_cash
        shift.cash_reconciled = True

        shift = self.repository.update(db, shift)

        # Log audit log
        self.audit_service.log_action(
            db,
            action="Ended Shift",
            target_table="shifts",
            target_id=str(shift.id),
            actor_id=actor_id,
            old_values=old_values,
            new_values={
                "end_time": str(end_time),
                "total_sales_amount": str(sales_total),
                "cash_sales": str(cash_sales),
                "expected_cash": str(expected_cash),
                "closing_cash_reported": str(reported_cash),
                "variance": str(shift.variance),
                "cash_reconciled": shift.cash_reconciled,
            }
        )
        return shift

    # -----------------------------------
    # 8:00 PM Daily Shift Settlement (Floating Staff + 6 AM Price Split)
    # -----------------------------------

    def get_settlement_defaults(
        self,
        db: Session,
        settlement_date: date,
    ) -> ShiftSettlementDefaultsResponse:
        from app.models.income import Income
        from app.models.nozzle import Nozzle
        from app.models.nozzle_reading import NozzleReading
        from app.services.price_schedule_service import PriceScheduleService

        latest = db.scalar(
            select(ShiftSettlement).order_by(
                ShiftSettlement.settlement_date.desc(),
                ShiftSettlement.id.desc(),
            )
        )
        previous_float = (
            Decimal(str(latest.cash_handed_to_next_shift))
            if latest
            else Decimal("0.00")
        )

        credit_total = db.scalar(
            select(func.coalesce(func.sum(Voucher.total_amount), Decimal("0.00")))
            .where(
                Voucher.invoice_date == settlement_date,
                Voucher.payment_mode == PaymentMode.CREDIT,
                Voucher.is_active.is_(True),
            )
        ) or Decimal("0.00")

        cash_expenses = db.scalar(
            select(func.coalesce(func.sum(Income.amount), Decimal("0.00")))
            .where(
                Income.income_date == settlement_date,
                Income.kind == IncomeKind.EXPENSE,
                Income.payment_mode == PaymentMode.CASH,
                Income.is_active.is_(True),
            )
        ) or Decimal("0.00")

        nozzles = db.scalars(
            select(Nozzle).where(Nozzle.is_active.is_(True)).order_by(Nozzle.id.asc())
        ).all()
        price_service = PriceScheduleService()
        nozzle_defaults: list[SettlementNozzleDefault] = []

        for n in nozzles:
            last_reading = db.scalar(
                select(NozzleReading)
                .where(NozzleReading.nozzle_id == n.id)
                .order_by(NozzleReading.reading_date.desc(), NozzleReading.id.desc())
            )
            opening = float(last_reading.closing_reading) if last_reading else 0.0
            active_rate = price_service.get_active_rate(db, n.fuel_type, settlement_date) or Decimal("0.00")
            nozzle_defaults.append(
                SettlementNozzleDefault(
                    nozzle_uuid=str(n.uuid),
                    nozzle_name=n.name,
                    fuel_type=n.fuel_type.value if hasattr(n.fuel_type, "value") else str(n.fuel_type),
                    opening_reading=opening,
                    active_rate=active_rate,
                )
            )

        return ShiftSettlementDefaultsResponse(
            settlement_date=settlement_date,
            previous_handover_float=previous_float,
            credit_vouchers_total=Decimal(str(credit_total)),
            cash_expenses_total=Decimal(str(cash_expenses)),
            nozzles=nozzle_defaults,
        )

    def list_settlements(self, db: Session, limit: int = 30) -> list[ShiftSettlement]:
        return list(
            db.scalars(
                select(ShiftSettlement)
                .order_by(ShiftSettlement.settlement_date.desc(), ShiftSettlement.id.desc())
                .limit(limit)
            ).all()
        )

    def create_settlement(
        self,
        db: Session,
        data: ShiftSettlementCreate,
        actor_id: int | None = None,
    ) -> ShiftSettlement:
        responsible_emp = None
        if data.responsible_employee_uuid:
            responsible_emp = db.scalar(
                select(Employee).where(Employee.uuid == data.responsible_employee_uuid)
            )
            if not responsible_emp:
                raise ValueError("Responsible employee not found.")

        computed_lines: list[dict] = []
        gross_sales = Decimal("0.00")

        for line in data.nozzle_lines:
            if line.interim_6am_reading is not None:
                vol_before = max(0.0, line.interim_6am_reading - line.opening_reading)
                vol_after = max(0.0, line.closing_reading - line.interim_6am_reading - line.testing_liters)
                new_rate = line.new_rate if line.new_rate is not None else line.old_rate
                line_amount = (
                    Decimal(str(vol_before)) * line.old_rate
                    + Decimal(str(vol_after)) * new_rate
                ).quantize(Decimal("0.01"))
                total_vol = vol_before + vol_after
            else:
                total_vol = max(0.0, line.closing_reading - line.opening_reading - line.testing_liters)
                line_amount = (Decimal(str(total_vol)) * line.old_rate).quantize(Decimal("0.01"))

            gross_sales += line_amount
            computed_lines.append({
                "nozzle_uuid": line.nozzle_uuid,
                "nozzle_name": line.nozzle_name,
                "fuel_type": line.fuel_type,
                "opening_reading": line.opening_reading,
                "interim_6am_reading": line.interim_6am_reading,
                "closing_reading": line.closing_reading,
                "testing_liters": line.testing_liters,
                "old_rate": float(line.old_rate),
                "new_rate": float(line.new_rate) if line.new_rate is not None else None,
                "volume_liters": round(total_vol, 3),
                "amount": float(line_amount),
            })

        if not data.nozzle_lines and data.manual_gross_sales is not None:
            gross_sales = data.manual_gross_sales

        expected_cash = (
            data.opening_float
            + gross_sales
            - data.credit_sales_total
            - data.upi_total
            - data.card_edc_total
            - data.omc_fleet_card_total
            - data.expenses_cash_total
            - data.cash_handed_to_next_shift
        ).quantize(Decimal("0.01"))

        actual_cash = (
            Decimal(data.notes_500) * Decimal("500")
            + Decimal(data.notes_200) * Decimal("200")
            + Decimal(data.notes_100) * Decimal("100")
            + Decimal(data.notes_50) * Decimal("50")
            + Decimal(data.notes_20) * Decimal("20")
            + Decimal(data.notes_10) * Decimal("10")
            + data.coins_amount
        ).quantize(Decimal("0.01"))

        variance = (actual_cash - expected_cash).quantize(Decimal("0.01"))

        settlement = ShiftSettlement(
            settlement_date=data.settlement_date,
            shift_label=data.shift_label,
            attendant_names=data.attendant_names,
            responsible_employee_id=responsible_emp.id if responsible_emp else None,
            opening_float=data.opening_float,
            gross_meter_sales=gross_sales,
            credit_sales_total=data.credit_sales_total,
            upi_total=data.upi_total,
            card_edc_total=data.card_edc_total,
            omc_fleet_card_total=data.omc_fleet_card_total,
            mdr_fee_percent=data.mdr_fee_percent,
            digital_settlement_status="PENDING" if (data.upi_total + data.card_edc_total) > 0 else "SETTLED",
            expenses_cash_total=data.expenses_cash_total,
            cash_handed_to_next_shift=data.cash_handed_to_next_shift,
            expected_cash_in_hand=expected_cash,
            actual_cash_counted=actual_cash,
            variance=variance,
            notes_500=data.notes_500,
            notes_200=data.notes_200,
            notes_100=data.notes_100,
            notes_50=data.notes_50,
            notes_20=data.notes_20,
            notes_10=data.notes_10,
            coins_amount=data.coins_amount,
            charge_shortage_to_staff=data.charge_shortage_to_staff,
            nozzle_lines=computed_lines,
            notes=data.notes,
        )
        db.add(settlement)
        db.flush()

        if data.charge_shortage_to_staff and variance < Decimal("0.00") and responsible_emp is not None:
            from app.models.staff_ledger_entry import StaffLedgerEntry

            shortage_amt = abs(variance)
            db.add(
                StaffLedgerEntry(
                    employee_id=responsible_emp.id,
                    entry_date=data.settlement_date,
                    entry_type="SHORTAGE",
                    amount=shortage_amt,
                    signed_amount=shortage_amt,
                    remarks=f"Shift shortage ({data.shift_label} {data.settlement_date})",
                    reference_type="SHIFT_SETTLEMENT",
                    reference_id=settlement.id,
                    pump_id=settlement.pump_id,
                )
            )

        db.commit()
        db.refresh(settlement)

        self.audit_service.log_action(
            db,
            action="Recorded Shift Settlement",
            target_table="shift_settlements",
            target_id=str(settlement.id),
            actor_id=actor_id,
            new_values={
                "settlement_date": str(data.settlement_date),
                "shift_label": data.shift_label,
                "gross_meter_sales": str(gross_sales),
                "expected_cash": str(expected_cash),
                "actual_cash": str(actual_cash),
                "variance": str(variance),
            },
        )
        return settlement

    def settle_digital(
        self,
        db: Session,
        settlement_uuid: str,
        bank_account_uuid: str,
        settled_date: date,
        actor_id: int | None = None,
    ) -> ShiftSettlement:
        from app.models.bank_account import BankAccount, BankTransaction

        settlement = db.scalar(
            select(ShiftSettlement).where(ShiftSettlement.uuid == settlement_uuid)
        )
        if not settlement:
            raise ValueError("Shift settlement not found.")
        if settlement.digital_settlement_status == "SETTLED":
            raise ValueError("Digital batch is already settled.")

        bank = db.scalar(
            select(BankAccount).where(BankAccount.uuid == str(bank_account_uuid))
        )
        if not bank:
            raise ValueError("Bank account not found.")

        mdr_fee = (
            settlement.card_edc_total * (settlement.mdr_fee_percent / Decimal("100"))
        ).quantize(Decimal("0.01"))
        net_credit = (settlement.upi_total + settlement.card_edc_total - mdr_fee).quantize(Decimal("0.01"))

        if net_credit > Decimal("0.00"):
            bank.current_balance = bank.current_balance + net_credit
            db.add(
                BankTransaction(
                    bank_account_id=bank.id,
                    transaction_type="DEPOSIT",
                    amount=net_credit,
                    transaction_date=settled_date,
                    remarks=(
                        f"UPI+Card settlement ({settlement.shift_label} {settlement.settlement_date})"
                        + (f", MDR fee ₹{mdr_fee}" if mdr_fee > 0 else "")
                    ),
                    pump_id=bank.pump_id,
                )
            )

        settlement.digital_settlement_status = "SETTLED"
        db.commit()
        db.refresh(settlement)

        self.audit_service.log_action(
            db,
            action="Settled Shift Digital Batch",
            target_table="shift_settlements",
            target_id=str(settlement.id),
            actor_id=actor_id,
            new_values={
                "bank_account": bank.account_name,
                "net_credited": str(net_credit),
                "mdr_fee": str(mdr_fee),
            },
        )
        return settlement
