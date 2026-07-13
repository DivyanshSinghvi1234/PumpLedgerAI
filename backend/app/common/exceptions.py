from __future__ import annotations


class BusinessException(Exception):
    """
    Base business exception.
    """


class DuplicateRecordError(
    BusinessException,
):
    pass


class RecordNotFoundError(
    BusinessException,
):
    pass


class ValidationError(
    BusinessException,
):
    pass