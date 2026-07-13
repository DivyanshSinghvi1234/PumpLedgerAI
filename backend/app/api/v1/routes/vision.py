from fastapi import APIRouter, HTTPException

from app.services.vision_service import VisionService

router = APIRouter(
    prefix="/vision",
    tags=["Vision"],
)

service = VisionService()


@router.post("/ocr")
async def ocr(
    image_path: str,
):
    try:
        return await service.extract(image_path)

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )