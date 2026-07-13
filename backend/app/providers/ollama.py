from __future__ import annotations

from app.providers.base import VisionProvider


class OllamaProvider(VisionProvider):

    async def extract_data(
        self,
        image_path: str,
    ) -> dict:

        return {
            "provider": "ollama",
            "status": "not_implemented",
            "image_path": image_path,
        }