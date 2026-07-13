from fastapi import APIRouter, HTTPException, UploadFile, status

from app.core.vision_exceptions import OCRException
from app.services.upload_service import UploadService
from app.schemas.review import ReviewResponse

router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"],
)

service = UploadService()


@router.post(
    "",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    file: UploadFile,
):
    try:
        return await service.upload_image(file)
    except OCRException as exc:
        # Surface the real OCR/provider failure (bad/missing API key,
        # unreadable image, provider error) instead of an opaque 500.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
