from __future__ import annotations

import mimetypes
from pathlib import Path

import anyio
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.vision_exceptions import OCRProviderException
from app.prompts.system_prompt import SYSTEM_PROMPT
from app.prompts.voucher_prompt import VOUCHER_PROMPT
from app.schemas.ocr import OCRExtraction
from app.utils.image_validator import ImageValidator

# Bound the Gemini call so a slow/hung provider can't tie up a worker forever.
# SDK timeout is expressed in milliseconds.
_GEMINI_TIMEOUT_MS = 30_000


class GeminiProvider:

    def __init__(self):
        self.client = genai.Client(
            api_key=settings.GOOGLE_API_KEY,
            http_options=types.HttpOptions(timeout=_GEMINI_TIMEOUT_MS),
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
            # The google-genai SDK call is synchronous and blocking. Run it in a
            # worker thread so it never freezes the async event loop — otherwise a
            # single 20-30s OCR call stalls the whole worker (missed health checks,
            # dropped connections). Mirrors the async httpx clients in the other
            # providers.
            def _call() -> "types.GenerateContentResponse":
                return self.client.models.generate_content(
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

            response = await anyio.to_thread.run_sync(_call)

            return response.parsed

        except (AttributeError, TypeError, NameError, ValueError, KeyError, IndexError):
            raise
        except Exception as exc:
            raise OCRProviderException(
                f"Gemini OCR failed: {exc}"
            ) from exc