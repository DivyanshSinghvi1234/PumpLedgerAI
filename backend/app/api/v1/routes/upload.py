import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, status

from app.core.vision_exceptions import OCRException
from app.services.upload_service import UploadService
from app.schemas.review import ReviewResponse

router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"],
)

service = UploadService()

MAX_BATCH_FILES = 30
_BATCH_CONCURRENCY = 4


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


@router.post(
    "/batch",
    status_code=status.HTTP_201_CREATED,
)
async def upload_batch_images(
    files: list[UploadFile],
):
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image file is required.",
        )
    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch upload supports up to {MAX_BATCH_FILES} images at a time.",
        )

    semaphore = asyncio.Semaphore(_BATCH_CONCURRENCY)

    async def _process_one(f: UploadFile) -> dict:
        async with semaphore:
            try:
                review = await service.upload_image(f)
                return {
                    "filename": f.filename or "slip",
                    "status": "ok",
                    "review": review.model_dump(mode="json"),
                }
            except HTTPException as exc:
                return {
                    "filename": f.filename or "slip",
                    "status": "error",
                    "error": str(exc.detail),
                }
            except Exception as exc:
                return {
                    "filename": f.filename or "slip",
                    "status": "error",
                    "error": str(exc),
                }

    results = await asyncio.gather(*(_process_one(f) for f in files))
    succeeded = sum(1 for r in results if r["status"] == "ok")
    failed = len(results) - succeeded

    return {
        "total": len(results),
        "succeeded": succeeded,
        "failed": failed,
        "results": results,
    }
