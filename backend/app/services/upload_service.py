from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.schemas.upload import UploadResponse
from app.services.vision_service import VisionService
from app.schemas.review import ReviewResponse
from app.services.ocr_review_service import OCRReviewService


class UploadService:
    ALLOWED_TYPES = {
        "image/jpeg",
        "image/png",
        "image/jpg",
    }

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    def __init__(self):
        self.upload_dir = Path("storage/invoices")
        self.upload_dir.mkdir(
            parents=True,
            exist_ok=True,
        )
        self.vision_service = VisionService()
        self.review_service = OCRReviewService()

    async def upload_image(
        self,
        file: UploadFile,
    ) -> ReviewResponse:

        if file.content_type not in self.ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Only JPG and PNG images are supported.",
            )

        extension = Path(file.filename).suffix.lower()

        filename = f"{uuid4()}{extension}"

        filepath = self.upload_dir / filename

        with filepath.open("wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        upload = UploadResponse(
            filename=filename,
            original_filename=file.filename,
            content_type=file.content_type,
            file_size=filepath.stat().st_size,
            image_path=str(filepath),
        )

        ocr = await self.vision_service.extract(
            str(filepath),
        )

        review = self.review_service.review(
            ocr,
        )

        return review