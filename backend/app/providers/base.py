from __future__ import annotations

from abc import ABC, abstractmethod

from app.schemas.ocr import OCRExtraction


class VisionProvider(ABC):

    @abstractmethod
    async def extract_data(
        self,
        image_path: str,
    ) -> OCRExtraction:
        ...

    @abstractmethod
    async def extract_data_from_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> OCRExtraction:
        ...