from decimal import Decimal
from enum import Enum


class FuelType(str, Enum):
    PETROL = "PETROL"
    SPEED = "SPEED"
    DIESEL = "DIESEL"
    LUBRICANT = "LUBRICANT"


class PaymentMode(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    CREDIT = "CREDIT"


class IncomeKind(str, Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    DEPOSIT = "DEPOSIT"


class VerificationStatus(str, Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class PaymentStatus(str, Enum):
    """Settlement state of a voucher — how much of it has been paid.

    Distinct from ``VerificationStatus`` (which tracks OCR review). A cash/
    UPI/card sale is paid on the spot (PAID); a CREDIT sale starts UNPAID and
    moves through PARTIAL to PAID as payments are allocated to it.
    """
    UNPAID = "UNPAID"
    PARTIAL = "PARTIAL"
    PAID = "PAID"


class TallyStatus(str, Enum):
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"


class AIProvider(str, Enum):
    GEMINI = "GEMINI"
    OPENROUTER = "OPENROUTER"
    OLLAMA = "OLLAMA"
    GROQ = "GROQ"


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"


class NozzleStatus(str, Enum):
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    OUT_OF_ORDER = "OUT_OF_ORDER"

class VoucherSortField(str, Enum):
    invoice_date = "invoice_date"
    invoice_number = "invoice_number"
    customer_name = "customer_name"
    vehicle_number = "vehicle_number"
    fuel_type = "fuel_type"
    payment_mode = "payment_mode"
    total_amount = "total_amount"
    created_at = "created_at"
    updated_at = "updated_at"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class LedgerEntryType(str, Enum):
    OPENING_BALANCE = "OPENING_BALANCE"
    VOUCHER = "VOUCHER"
    PAYMENT = "PAYMENT"
    DEBIT_ADJUSTMENT = "DEBIT_ADJUSTMENT"
    CREDIT_ADJUSTMENT = "CREDIT_ADJUSTMENT"


# Entry types that INCREASE what the customer owes (debit / +).
# Everything else is a credit (-) that reduces the receivable.
DEBIT_ENTRY_TYPES = frozenset(
    {
        LedgerEntryType.OPENING_BALANCE,
        LedgerEntryType.VOUCHER,
        LedgerEntryType.DEBIT_ADJUSTMENT,
    }
)


def signed_amount(
    entry_type: LedgerEntryType,
    amount: Decimal,
) -> Decimal:
    """
    Return the signed effect of a ledger entry on outstanding_balance:
    positive for debits (customer owes more), negative for credits.
    ``amount`` is always stored positive; direction comes from the type.
    """
    if entry_type in DEBIT_ENTRY_TYPES:
        return amount

    return -amount