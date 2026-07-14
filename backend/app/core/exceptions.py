class AppException(Exception):
    """Base application exception."""
    pass


class VoucherNotFoundError(AppException):
    def __init__(self, voucher_uuid: str):
        self.voucher_uuid = voucher_uuid
        super().__init__(f"Voucher '{voucher_uuid}' not found.")


class DuplicateInvoiceError(AppException):
    def __init__(self, invoice_number: str):
        self.invoice_number = invoice_number
        super().__init__(
            f"Invoice '{invoice_number}' already exists."
        )


class PaymentNotFoundError(AppException):
    def __init__(self, payment_uuid: str):
        self.payment_uuid = payment_uuid
        super().__init__(f"Payment '{payment_uuid}' not found.")


class SettlementError(AppException):
    """Raised when a voucher settlement/allocation is invalid (amount
    exceeds the balance due, voucher belongs to another customer, etc.)."""
    pass


# -------------------------
# Customer Exceptions
# -------------------------

class CustomerNotFoundError(Exception):
    def __init__(self, customer_uuid: str):
        super().__init__(
            f"Customer '{customer_uuid}' not found."
        )


class DuplicateCustomerPhoneError(Exception):
    def __init__(self, phone: str):
        super().__init__(
            f"Phone number '{phone}' already exists."
        )


class DuplicateCustomerGSTError(Exception):
    def __init__(self, gst_number: str):
        super().__init__(
            f"GST number '{gst_number}' already exists."
        )

class VehicleNotFoundError(Exception):
    def __init__(self, vehicle_uuid: str):
        super().__init__(
            f"Vehicle '{vehicle_uuid}' not found."
        )


class DuplicateVehicleNumberError(Exception):
    def __init__(self, vehicle_number: str):
        super().__init__(
            f"Vehicle number '{vehicle_number}' already exists."
        )

class DuplicateCustomerCodeError(AppException):
    def __init__(self, customer_code: str):
        self.customer_code = customer_code

        super().__init__(
            f"Customer code '{customer_code}' already exists."
        )


# -------------------------
# User Exceptions
# -------------------------

class UserNotFoundError(AppException):
    def __init__(self, user_uuid: str):
        super().__init__(f"User '{user_uuid}' not found.")


class DuplicateUsernameError(AppException):
    def __init__(self, username: str):
        super().__init__(f"Username '{username}' already exists.")


class InvalidPasswordError(AppException):
    def __init__(self) -> None:
        super().__init__("Current password is incorrect.")


# -------------------------
# Employee Exceptions
# -------------------------

class EmployeeNotFoundError(AppException):
    def __init__(self, employee_uuid: str):
        super().__init__(f"Employee '{employee_uuid}' not found.")


class DuplicateEmployeeEmailError(AppException):
    def __init__(self, email: str):
        super().__init__(f"Employee email '{email}' already exists.")