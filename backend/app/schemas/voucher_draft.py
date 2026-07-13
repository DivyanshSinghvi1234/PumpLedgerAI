from pydantic import BaseModel

from app.schemas.ocr import OCRExtraction
from app.schemas.upload import UploadResponse


class VoucherDraft(BaseModel):
    upload: UploadResponse
    extracted_data: OCRExtraction
    ready_to_save: bool = False