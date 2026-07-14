from app.schemas.upload import UploadResponse
from app.schemas.vision import OCRResult
from app.schemas.voucher import (
    VoucherCreate,
    VoucherResponse,
    VoucherUpdate,
)
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
)
from app.schemas.vehicle import (
    VehicleCreate,
    VehicleUpdate,
    VehicleResponse,
)
from app.schemas.nozzle import (
    NozzleCreate,
    NozzleResponse,
    NozzleReadingCreate,
    NozzleReadingResponse,
    FuelDispenserCreate,
    FuelDispenserUpdate,
    FuelDispenserResponse,
    BulkNozzleReadingCreate,
    BulkFormNozzleItem,
    BulkFormResponse,
)
__all__ = [
    "VoucherCreate",
    "VoucherUpdate",
    "VoucherResponse",
    "UploadResponse",
    "OCRResult",

    "CustomerCreate",
    "CustomerUpdate",
    "CustomerResponse",
    "VehicleCreate",
    "VehicleUpdate",
    "VehicleResponse",
    "NozzleCreate",
    "NozzleResponse",
    "NozzleReadingCreate",
    "NozzleReadingResponse",
    "FuelDispenserCreate",
    "FuelDispenserUpdate",
    "FuelDispenserResponse",
    "BulkNozzleReadingCreate",
    "BulkFormNozzleItem",
    "BulkFormResponse",
]