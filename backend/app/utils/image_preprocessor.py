import io
import os
import mimetypes
from PIL import Image, ImageEnhance
from app.core.logging import get_logger

logger = get_logger(__name__)

class ImagePreprocessor:
    """Preprocess invoice images using Pillow in memory to improve OCR accuracy and latency."""

    @staticmethod
    def preprocess_to_bytes(image_path: str) -> tuple[bytes, str]:
        """
        Apply preprocessing in memory:
        1. Open image
        2. Convert to RGB
        3. Downscale if max dimension > 1600px to optimize upload latency
        4. Upscale if width is too small (< 800px)
        5. Enhance contrast and sharpness
        6. Save to JPEG bytes directly in memory
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        try:
            # Guess MIME type
            mime_type, _ = mimetypes.guess_type(image_path)
            if mime_type is None:
                mime_type = "image/jpeg"

            img = Image.open(image_path)
            
            # Ensure RGB mode
            if img.mode != "RGB":
                img = img.convert("RGB")

            # 1. Downscale if too large to save network upload time (free tier latency)
            w, h = img.size
            MAX_DIMENSION = 1600
            if max(w, h) > MAX_DIMENSION:
                scale = MAX_DIMENSION / max(w, h)
                new_w = int(w * scale)
                new_h = int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                logger.info(f"Downscaled image from {w}x{h} to {new_w}x{new_h}")
            # 2. Upscale if too small (low res images scan poorly)
            elif w < 800:
                scale = 1200 / w
                new_w = int(w * scale)
                new_h = int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                logger.info(f"Upscaled image from {w}x{h} to {new_w}x{new_h}")

            # 3. Enhance contrast (factors > 1.0 increase contrast)
            contrast_enhancer = ImageEnhance.Contrast(img)
            img = contrast_enhancer.enhance(1.5)

            # 4. Enhance sharpness (factors > 1.0 sharpen)
            sharpness_enhancer = ImageEnhance.Sharpness(img)
            img = sharpness_enhancer.enhance(2.0)

            # 5. Save directly to JPEG bytes in memory
            output_buffer = io.BytesIO()
            img.save(output_buffer, format="JPEG", quality=90)
            processed_bytes = output_buffer.getvalue()

            logger.info(f"Preprocessed image successfully in memory (~{len(processed_bytes)/1024:.1f} KB)")
            return processed_bytes, "image/jpeg"

        except Exception as exc:
            logger.error(f"Image preprocessing failed for {image_path}: {exc}")
            raise
