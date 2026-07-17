from __future__ import annotations

import mimetypes
from pathlib import Path

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.vision_exceptions import OCRProviderException
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.prompts.voucher_prompt import VOUCHER_PROMPT
from app.schemas.ocr import OCRExtraction
from app.utils.image_validator import ImageValidator


class GeminiProvider:

    def __init__(self):
        self.client = genai.Client(
            api_key=settings.GOOGLE_API_KEY,
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

            # Detect MIME type automatically
            mime_type, _ = mimetypes.guess_type(image_path)
            if mime_type is None:
                mime_type = "image/jpeg"

            return await self.extract_data_from_bytes(image_bytes, mime_type)

        except (AttributeError, TypeError, NameError, ValueError, KeyError, IndexError):
            raise
        except Exception as exc:
            raise OCRProviderException(
                f"Gemini OCR failed: {exc}"
            ) from exc

    async def extract_data_from_bytes(
        self,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> OCRExtraction:
        try:
            # Call Gemini
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[
                    SYSTEM_PROMPT,
                    VOUCHER_PROMPT,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=OCRExtraction,
                    temperature=0,
                ),
            )

            return response.parsed

        except (AttributeError, TypeError, NameError, ValueError, KeyError, IndexError):
            raise
        except Exception as exc:
            raise OCRProviderException(
                f"Gemini OCR failed: {exc}"
            ) from exc