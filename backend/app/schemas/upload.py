from pydantic import BaseModel


class UploadResponse(BaseModel):
    filename: str
    original_filename: str
    content_type: str
    file_size: int
    image_path: str