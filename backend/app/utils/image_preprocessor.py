import io
import os
import mimetypes
import cv2
import numpy as np
from PIL import Image, ImageEnhance
from app.core.logging import get_logger

logger = get_logger(__name__)

class ImagePreprocessor:
    """Preprocess invoice images using Pillow and OpenCV in memory to improve OCR accuracy and latency."""

    @staticmethod
    def preprocess_to_bytes(image_path: str) -> tuple[bytes, str]:
        """
        Apply preprocessing in memory:
        1. Open image
        2. Convert to RGB
        3. Deskew image using OpenCV minAreaRect contours
        4. Downscale if max dimension > 1280px to optimize upload latency
        5. Upscale if width is too small (< 800px)
        6. Enhance contrast and sharpness
        7. Save to JPEG bytes directly in memory (quality 80)
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

            # 1. OpenCV-based Deskewing (rotation correction)
            try:
                img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
                
                coords = np.column_stack(np.where(thresh > 0))
                if len(coords) > 0:
                    angle = cv2.minAreaRect(coords)[-1]
                    if angle < -45:
                        angle = -(90 + angle)
                    else:
                        angle = -angle
                    
                    if abs(angle) > 0.5:
                        h_cv, w_cv = img_cv.shape[:2]
                        center = (w_cv // 2, h_cv // 2)
                        M = cv2.getRotationMatrix2D(center, angle, 1.0)
                        img_cv = cv2.warpAffine(img_cv, M, (w_cv, h_cv), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                        img = Image.fromarray(cv2.cvtColor(img_cv, cv2.COLOR_BGR2RGB))
                        logger.info(f"Deskewed image by {angle:.2f} degrees")
            except Exception as deskew_exc:
                logger.warning(f"Deskewing failed (skipping): {deskew_exc}")

            # 2. Downscale if too large to save network upload time (free tier latency)
            w, h = img.size
            MAX_DIMENSION = 1280
            if max(w, h) > MAX_DIMENSION:
                scale = MAX_DIMENSION / max(w, h)
                new_w = int(w * scale)
                new_h = int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                logger.info(f"Downscaled image from {w}x{h} to {new_w}x{new_h}")
            # 3. Upscale if too small (low res images scan poorly)
            elif w < 800:
                scale = 1200 / w
                new_w = int(w * scale)
                new_h = int(h * scale)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                logger.info(f"Upscaled image from {w}x{h} to {new_w}x{new_h}")

            # 4. Enhance contrast (factors > 1.0 increase contrast)
            contrast_enhancer = ImageEnhance.Contrast(img)
            img = contrast_enhancer.enhance(1.5)

            # 5. Enhance sharpness (factors > 1.0 sharpen)
            sharpness_enhancer = ImageEnhance.Sharpness(img)
            img = sharpness_enhancer.enhance(2.0)

            # 6. Save directly to JPEG bytes in memory (80% quality)
            output_buffer = io.BytesIO()
            img.save(output_buffer, format="JPEG", quality=80)
            processed_bytes = output_buffer.getvalue()

            logger.info(f"Preprocessed image successfully in memory (~{len(processed_bytes)/1024:.1f} KB)")
            return processed_bytes, "image/jpeg"

        except Exception as exc:
            logger.error(f"Image preprocessing failed for {image_path}: {exc}")
            raise
