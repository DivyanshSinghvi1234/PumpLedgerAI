from __future__ import annotations

from pathlib import Path

from app.core.enums import AIProvider
from app.core.logging import get_logger
from app.providers.gemini import GeminiProvider
from app.providers.openrouter import OpenRouterProvider
from app.schemas.vision import OCRResult
from app.services.ocr_parser import OCRParser
from app.utils.image_preprocessor import ImagePreprocessor

logger = get_logger(__name__)


class VisionService:

    def __init__(self):
        self.preprocessor = ImagePreprocessor()
        # Instantiate the providers in the fallback sequence (Gemini primary -> OpenRouter fallback)
        self.providers = [
            (AIProvider.GEMINI, GeminiProvider()),
            (AIProvider.OPENROUTER, OpenRouterProvider())
        ]

    async def extract(
        self,
        image_path: str,
    ) -> OCRResult:
        # Preprocess the image in memory
        try:
            image_bytes, mime_type = self.preprocessor.preprocess_to_bytes(image_path)
        except Exception as preprocess_exc:
            logger.warning(
                f"Image preprocessing failed for {image_path}: {preprocess_exc}. Falling back to original file bytes."
            )
            import mimetypes
            image_bytes = Path(image_path).read_bytes()
            mime_type, _ = mimetypes.guess_type(image_path)
            if mime_type is None:
                mime_type = "image/jpeg"

        # Try Primary Provider (Gemini)
        primary_enum, primary_inst = self.providers[0]
        try:
            logger.info(f"Attempting OCR extraction using primary provider: {primary_enum.value}")
            extraction = await primary_inst.extract_data_from_bytes(image_bytes, mime_type)
            result = OCRParser.parse(extraction, image_path=image_path)
            result.provider = primary_enum
            return result
        except Exception as primary_exc:
            logger.warning(f"Primary provider {primary_enum.value} failed: {primary_exc}. Trying fallback...")
            
            if len(self.providers) > 1:
                fallback_enum, fallback_inst = self.providers[1]
                try:
                    logger.info(f"Attempting OCR extraction using fallback provider: {fallback_enum.value}")
                    extraction = await fallback_inst.extract_data_from_bytes(image_bytes, mime_type)
                    result = OCRParser.parse(extraction, image_path=image_path)
                    result.provider = fallback_enum
                    return result
                except Exception as fallback_exc:
                    logger.error(f"Fallback provider {fallback_enum.value} failed: {fallback_exc}")
                    raise fallback_exc
            raise primary_exc