from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.core.enums import AIProvider
from app.core.logging import get_logger
from app.core.vision_exceptions import OCRProviderException
from app.providers.gemini import GeminiProvider
from app.providers.groq import GroqProvider
from app.providers.openrouter import OpenRouterProvider
from app.schemas.vision import OCRResult
from app.services.ocr_parser import OCRParser
from app.utils.image_preprocessor import ImagePreprocessor

logger = get_logger(__name__)


class VisionService:

    def __init__(self):
        self.preprocessor = ImagePreprocessor()
        
        # Instantiate available providers
        gemini = GeminiProvider()
        openrouter = OpenRouterProvider()
        groq = GroqProvider()
        
        # Map of enum to provider instance
        self.provider_map = {
            AIProvider.GEMINI: gemini,
            AIProvider.OPENROUTER: openrouter,
            AIProvider.GROQ: groq,
        }
        
        # Sane default fallback sequence: Gemini -> Groq -> OpenRouter
        primary_str = settings.AI_PROVIDER.upper() if settings.AI_PROVIDER else "GEMINI"
        try:
            primary_enum = AIProvider(primary_str)
        except ValueError:
            logger.warning(f"Unknown AI_PROVIDER setting '{settings.AI_PROVIDER}'. Defaulting to GEMINI.")
            primary_enum = AIProvider.GEMINI

        primary_inst = self.provider_map[primary_enum]
        
        # Sequence of providers starting with configured primary
        self.providers = [(primary_enum, primary_inst)]
        
        fallback_order = [
            AIProvider.GEMINI,
            AIProvider.GROQ,
            AIProvider.OPENROUTER,
        ]
        
        for provider_enum in fallback_order:
            if provider_enum != primary_enum:
                self.providers.append((provider_enum, self.provider_map[provider_enum]))

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

        last_exc = None
        for i, (provider_enum, provider_inst) in enumerate(self.providers):
            # Skip provider if required API keys are not configured
            if provider_enum == AIProvider.GEMINI and not settings.GOOGLE_API_KEY:
                logger.debug("Skipping Gemini: GOOGLE_API_KEY is not configured.")
                continue
            if provider_enum == AIProvider.OPENROUTER and not settings.OPENROUTER_API_KEY:
                logger.debug("Skipping OpenRouter: OPENROUTER_API_KEY is not configured.")
                continue
            if provider_enum == AIProvider.GROQ and not settings.GROQ_API_KEY:
                logger.debug("Skipping Groq: GROQ_API_KEY is not configured.")
                continue

            try:
                role_str = "primary" if i == 0 else "fallback"
                logger.info(f"Attempting OCR extraction using {role_str} provider: {provider_enum.value}")
                extraction = await provider_inst.extract_data_from_bytes(image_bytes, mime_type)
                result = OCRParser.parse(extraction, image_path=image_path)
                result.provider = provider_enum
                return result
            except OCRProviderException as exc:
                logger.warning(f"Provider {provider_enum.value} failed: {exc}")
                last_exc = exc

        if last_exc:
            raise last_exc
        raise Exception("No vision providers are configured or available.")