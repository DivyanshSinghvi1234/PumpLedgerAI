from pydantic import BaseModel

from app.schemas.upload import UploadResponse
from app.schemas.validation import ValidationResult
from app.schemas.vision import OCRResult


class OCRResponse(BaseModel):
    upload: UploadResponse
    ocr: OCRResult
    validation: ValidationResult