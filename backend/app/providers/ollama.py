from __future__ import annotations

import base64
from pathlib import Path
import httpx

from app.core.vision_exceptions import OCRProviderException
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.prompts.voucher_prompt import VOUCHER_PROMPT
from app.providers.base import VisionProvider
from app.schemas.ocr import OCRExtraction
from app.utils.image_validator import ImageValidator


class OllamaProvider(VisionProvider):

    async def extract_data(
        self,
        image_path: str,
    ) -> OCRExtraction:
        try:
            # Validate image
            ImageValidator.validate(image_path)

            # Read image bytes
            image_bytes = Path(image_path).read_bytes()

            return await self.extract_data_from_bytes(image_bytes)

        except Exception as exc:
            raise OCRProviderException(
                f"Ollama OCR failed: {exc}"
            ) from exc

    async def extract_data_from_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> OCRExtraction:
        try:
            base64_image = base64.b64encode(image_bytes).decode("utf-8")

            # Prepare prompt
            prompt = f"{SYSTEM_PROMPT}\n\n{VOUCHER_PROMPT}\n\nReturn a JSON object conforming exactly to the OCRExtraction schema."

            # Call local Ollama API
            payload = {
                "model": "llama3.2-vision",
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                        "images": [base64_image]
                    }
                ],
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0
                }
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "http://localhost:11434/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                result = response.json()

            # Extract response text and parse
            content = result.get("message", {}).get("content", "")
            if not content:
                raise OCRProviderException("Empty response from Ollama.")

            return OCRExtraction.model_validate_json(content)

        except Exception as exc:
            raise OCRProviderException(
                f"Ollama OCR failed: {exc}"
            ) from exc