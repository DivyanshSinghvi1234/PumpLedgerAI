from pathlib import Path

from PIL import Image


class ImageValidator:

    ALLOWED_EXTENSIONS = {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    }

    @classmethod
    def validate(
        cls,
        image_path: str,
    ) -> None:

        path = Path(image_path)

        if not path.exists():
            raise FileNotFoundError(image_path)

        if path.suffix.lower() not in cls.ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Unsupported image format: {path.suffix}"
            )

        Image.open(path).verify()