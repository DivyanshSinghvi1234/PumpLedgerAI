from app.schemas.ocr import OCRExtraction
from app.schemas.upload import UploadResponse

from pydantic import BaseModel


class UploadOCRResponse(BaseModel):
    upload: UploadResponse
    ocr: OCRExtraction