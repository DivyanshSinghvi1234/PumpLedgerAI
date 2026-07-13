from __future__ import annotations

from app.core.enums import AIProvider
from app.core.logging import get_logger
from app.providers.gemini import GeminiProvider
from app.providers.ollama import OllamaProvider
from app.providers.openrouter import OpenRouterProvider
from app.schemas.vision import OCRResult
from app.services.ocr_parser import OCRParser

logger = get_logger(__name__)


class VisionService:

    def __init__(self):
        # Instantiate the providers in the fallback sequence
        self.providers = [
            (AIProvider.GEMINI, GeminiProvider()),
            (AIProvider.OPENROUTER, OpenRouterProvider()),
            (AIProvider.OLLAMA, OllamaProvider())
        ]

    async def extract(
        self,
        image_path: str,
    ) -> OCRResult:
        last_exception = None
        best_result = None

        for provider_enum, provider_inst in self.providers:
            try:
                logger.info(f"Attempting OCR extraction using provider: {provider_enum.value}")
                extraction = await provider_inst.extract_data(image_path)
                
                result = OCRParser.parse(
                    extraction,
                    image_path=image_path,
                )
                # Assign the actual provider enum that succeeded
                result.provider = provider_enum

                # Check confidence calibration
                if result.confidence is not None and result.confidence >= 0.85:
                    logger.info(
                        f"Successful high-confidence ({result.confidence:.2f}) extraction with {provider_enum.value}"
                    )
                    return result

                logger.warning(
                    f"Provider {provider_enum.value} returned low confidence ({result.confidence if result.confidence else 0.0}). Trying next provider..."
                )
                if best_result is None or (result.confidence or 0.0) > (best_result.confidence or 0.0):
                    best_result = result

            except Exception as exc:
                logger.warning(f"OCR provider {provider_enum.value} failed: {exc}")
                last_exception = exc

        # If we got at least one result, return the best candidate
        if best_result is not None:
            logger.warning(
                f"No provider achieved high confidence. Returning best candidate from {best_result.provider.value} with confidence {best_result.confidence}"
            )
            return best_result

        if last_exception:
            raise last_exception

        raise ValueError("No OCR providers configured or available.")