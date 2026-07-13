from __future__ import annotations

from pydantic import BaseModel

from app.schemas.vision import OCRResult


class ValidationResult(BaseModel):

    warnings: list[str] = []

    errors: list[str] = []


class ReviewResponse(BaseModel):

    ocr: OCRResult

    validation: ValidationResult

    ready_to_save: bool