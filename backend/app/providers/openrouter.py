from __future__ import annotations

import base64
import mimetypes
from pathlib import Path
import httpx

from app.core.config import settings
from app.core.vision_exceptions import OCRProviderException
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.prompts.voucher_prompt import VOUCHER_PROMPT
from app.providers.base import VisionProvider
from app.schemas.ocr import OCRExtraction
from app.utils.image_validator import ImageValidator


class OpenRouterProvider(VisionProvider):

    async def extract_data(
        self,
        image_path: str,
    ) -> OCRExtraction:
        if not settings.OPENROUTER_API_KEY:
            raise OCRProviderException("OpenRouter API key is not configured.")

        try:
            # Validate image
            ImageValidator.validate(image_path)

            # Read and encode image to base64
            image_path_obj = Path(image_path)
            image_bytes = image_path_obj.read_bytes()
            base64_image = base64.b64encode(image_bytes).decode("utf-8")

            # Detect MIME type
            mime_type, _ = mimetypes.guess_type(image_path)
            if mime_type is None:
                mime_type = "image/jpeg"

            # Prepare prompt
            prompt = f"{SYSTEM_PROMPT}\n\n{VOUCHER_PROMPT}\n\nReturn a JSON object conforming exactly to the OCRExtraction schema."

            # Call OpenRouter API
            headers = {
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/singhvidivyansh/PumpLedgerAI",
                "X-Title": "PumpLedgerAI",
            }

            payload = {
                "model": "google/gemini-2.5-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                },
                            },
                        ],
                    }
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                result = response.json()

            # Extract response text and parse
            choices = result.get("choices", [])
            if not choices:
                raise OCRProviderException("Empty response from OpenRouter.")

            content = choices[0].get("message", {}).get("content", "")
            return OCRExtraction.model_validate_json(content)

        except Exception as exc:
            raise OCRProviderException(
                f"OpenRouter OCR failed: {exc}"
            ) from exc