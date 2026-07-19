from __future__ import annotations

import base64
import mimetypes
from pathlib import Path
import httpx

from app.core.config import settings
from app.core.vision_exceptions import OCRProviderException
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.prompts.voucher_prompt import VOUCHER_PROMPT
from app.schemas.ocr import OCRExtraction
from app.utils.image_validator import ImageValidator


class OpenRouterProvider:

    def __init__(self):
        self._client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
            timeout=httpx.Timeout(30.0)
        )

    async def extract_data(
        self,
        image_path: str,
    ) -> OCRExtraction:
        try:
            # Validate image
            ImageValidator.validate(image_path)

            # Read image bytes
            image_bytes = Path(image_path).read_bytes()

            # Detect MIME type
            mime_type, _ = mimetypes.guess_type(image_path)
            if mime_type is None:
                mime_type = "image/jpeg"

            return await self.extract_data_from_bytes(image_bytes, mime_type)

        except (AttributeError, TypeError, NameError, ValueError, KeyError, IndexError):
            raise
        except Exception as exc:
            raise OCRProviderException(
                f"OpenRouter OCR failed: {exc}"
            ) from exc

    async def extract_data_from_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> OCRExtraction:
        if not settings.OPENROUTER_API_KEY:
            raise OCRProviderException("OpenRouter API key is not configured.")

        try:
            base64_image = base64.b64encode(image_bytes).decode("utf-8")

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
                "model": settings.OPENROUTER_MODEL,
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

            response = await self._client.post(
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

        except (AttributeError, TypeError, NameError, ValueError, KeyError, IndexError):
            raise
        except Exception as exc:
            raise OCRProviderException(
                f"OpenRouter OCR failed: {exc}"
            ) from exc
