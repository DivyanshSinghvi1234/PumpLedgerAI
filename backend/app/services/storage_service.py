from __future__ import annotations

import shutil
from pathlib import Path
from typing import BinaryIO

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class StorageService:
    """
    Abstraction layer for file storage.

    - If R2 credentials are configured, uploads to Cloudflare R2 and returns
      a public https:// URL.
    - Otherwise falls back to saving to local disk under storage/invoices/
      (useful for local development without R2 credentials).
    """

    def __init__(self) -> None:
        self._r2_enabled = bool(
            settings.R2_ACCOUNT_ID
            and settings.R2_ACCESS_KEY_ID
            and settings.R2_SECRET_ACCESS_KEY
            and settings.R2_PUBLIC_URL
        )

        if self._r2_enabled:
            import boto3  # lazy import

            # Automatically support full S3 endpoints like Backblaze B2 (e.g. s3.us-west-004.backblazeb2.com)
            if "." in settings.R2_ACCOUNT_ID or settings.R2_ACCOUNT_ID.startswith("http"):
                endpoint_url = settings.R2_ACCOUNT_ID if settings.R2_ACCOUNT_ID.startswith("http") else f"https://{settings.R2_ACCOUNT_ID}"
                logger.info(f"StorageService: using custom S3 endpoint: {endpoint_url}")
            else:
                endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
                logger.info("StorageService: using Cloudflare R2")

            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",
            )
        else:
            self._local_dir = Path("storage/invoices")
            self._local_dir.mkdir(parents=True, exist_ok=True)
            logger.warning(
                "StorageService: R2 not configured, falling back to local disk. "
                "Files will be lost on Render redeploy."
            )

    def upload(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str,
    ) -> str:
        """
        Upload a file and return its public URL (R2) or local path (disk fallback).
        """
        if self._r2_enabled:
            return self._upload_r2(file_obj, filename, content_type)
        return self._upload_local(file_obj, filename)

    def _upload_r2(
        self,
        file_obj: BinaryIO,
        filename: str,
        content_type: str,
    ) -> str:
        self._client.upload_fileobj(
            file_obj,
            settings.R2_BUCKET_NAME,
            filename,
            ExtraArgs={"ContentType": content_type},
        )
        public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{filename}"
        logger.info("Uploaded %s to R2: %s", filename, public_url)
        return public_url

    def _upload_local(self, file_obj: BinaryIO, filename: str) -> str:
        # `filename` may carry a subdirectory prefix (e.g. "daily-sheets/x.jpg").
        # Route bare names into storage/invoices/ (back-compat); route prefixed
        # names under storage/<prefix>/ so the /storage mount can serve them.
        if "/" in filename or "\\" in filename:
            filepath = Path("storage") / filename
        else:
            filepath = self._local_dir / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with filepath.open("wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        local_path = str(filepath)
        logger.info("Saved %s to local disk: %s", filename, local_path)
        return local_path
