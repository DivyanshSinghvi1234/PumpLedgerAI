from fastapi import APIRouter

from app.services.vision_service import VisionService

router = APIRouter(
    prefix="/test",
    tags=["AI Testing"],
)

vision_service = VisionService()


@router.post("/vision")
async def test_vision(
    image_path: str,
):
    result = await vision_service.extract(image_path)

    return result