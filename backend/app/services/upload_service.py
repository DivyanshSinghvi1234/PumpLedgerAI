from __future__ import annotations

import io
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.schemas.upload import UploadResponse
from app.services.vision_service import VisionService
from app.schemas.review import ReviewResponse
from app.services.ocr_review_service import OCRReviewService
from app.services.storage_service import StorageService
from app.core.logging import get_logger

logger = get_logger(__name__)


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
        self.storage_service = StorageService()

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

        # 1. Save uploaded file temporarily to disk so preprocessor can read it
        with filepath.open("wb") as buffer:
            shutil.copyfileobj(
                file.file,
                buffer,
            )

        # 2. Extract OCR data (triggers in-memory preprocessing & Gemini call)
        ocr = await self.vision_service.extract(
            str(filepath),
        )

        # 3. Read preprocessed image bytes to save optimized, deskewed file instead of heavy original
        file_data = None
        try:
            from app.utils.image_preprocessor import ImagePreprocessor
            processed_bytes, _ = ImagePreprocessor.preprocess_to_bytes(str(filepath))
            file_data = io.BytesIO(processed_bytes)
        except Exception as prep_err:
            logger.warning(f"Could not read preprocessed bytes: {prep_err}. Falling back to original image.")
            file_data = filepath.open("rb")

        # 4. Upload optimized file via StorageService (Cloudflare R2 or local disk fallback)
        try:
            final_path = self.storage_service.upload(
                file_data,
                filename,
                "image/jpeg"
            )
            # If successfully uploaded to R2, delete the local temporary file
            if self.storage_service._r2_enabled:
                filepath.unlink(missing_ok=True)
                logger.info(f"Cleaned up local temp file: {filepath}")
        except Exception as storage_exc:
            logger.error(f"Failed to upload to storage: {storage_exc}. Keeping local file.")
            final_path = str(filepath)
        finally:
            if file_data and hasattr(file_data, "close"):
                file_data.close()

        # Update OCR result path to match R2 URL or local path
        ocr.image_path = final_path

        review = self.review_service.review(
            ocr,
        )

        return review