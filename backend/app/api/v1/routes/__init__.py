from app.api.v1.routes.upload import router as upload_router
from app.api.v1.routes.voucher import router as voucher_router

__all__ = [
    "voucher_router",
    "upload_router",
]