from pydantic import BaseModel


class ValidationResult(BaseModel):
    valid: bool
    warnings: list[str] = []
    errors: list[str] = []