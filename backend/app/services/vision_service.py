from __future__ import annotations

from app.core.config import settings
from app.providers.gemini import GeminiProvider
from app.providers.ollama import OllamaProvider
from app.providers.openrouter import OpenRouterProvider
from app.schemas.vision import OCRResult
from app.services.ocr_parser import OCRParser



class VisionService:

    def __init__(self):

        provider = settings.AI_PROVIDER.lower()

        if provider == "gemini":
            self.provider = GeminiProvider()

        elif provider == "openrouter":
            self.provider = OpenRouterProvider()

        elif provider == "ollama":
            self.provider = OllamaProvider()

        else:
            raise ValueError(
                f"Unsupported AI provider: {provider}"
            )

    async def extract(
        self,
        image_path: str,
    ) -> OCRResult:

        extraction = await self.provider.extract_data(
            image_path
        )

        return OCRParser.parse(
            extraction,
            image_path=image_path,
        )