"""Tests for the OCR & Vision pipeline: parsing, review confidence thresholds,
validation rules, and provider fallback behavior."""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.enums import AIProvider, FuelType, PaymentMode
from app.core.vision_exceptions import OCRProviderException
from app.schemas.ocr import OCRExtraction, OCRExtractionItem
from app.schemas.vision import OCRResult, OCRResultItem
from app.services.ocr_parser import OCRParser
from app.services.ocr_review_service import OCRReviewService
from app.services.ocr_validator import OCRValidator
from app.services.vision_service import VisionService


def _make_ocr_result(**overrides) -> OCRResult:
    defaults = {
        "provider": AIProvider.GEMINI,
        "confidence": 0.95,
        "invoice_number": "INV-001",
        "invoice_date": "2026-09-27",
        "customer_name": "Sharma Transport",
        "vehicle_number": "RJ14AB1234",
        "total_amount": Decimal("1000.00"),
        "payment_mode": PaymentMode.CREDIT,
        "image_path": "storage/test.jpg",
        "items": [
            OCRResultItem(
                fuel_type=FuelType.DIESEL,
                quantity_liters=Decimal("10.00"),
                rate_per_liter=Decimal("100.00"),
                total_amount=Decimal("1000.00"),
            )
        ],
    }
    defaults.update(overrides)
    return OCRResult(**defaults)


def test_ocr_parser_normalizes_fields_and_items():
    extraction = OCRExtraction(
        invoice_number="  HP/2026/001  ",
        invoice_date="2026-09-27",
        customer_name="  Ram Kumar  ",
        vehicle_number="  dl01ab1234 ",
        total_amount=Decimal("950.00"),
        payment_mode=PaymentMode.CASH,
        remarks="  Full tank  ",
        confidence=0.92,
        items=[
            OCRExtractionItem(
                fuel_type=FuelType.PETROL,
                quantity_liters=Decimal("10.00"),
                rate_per_liter=Decimal("95.00"),
                total_amount=Decimal("950.00"),
            )
        ],
    )

    result = OCRParser.parse(extraction, image_path="storage/slip.jpg")

    assert result.provider == AIProvider.GEMINI
    assert result.invoice_number == "HP/2026/001"
    assert result.customer_name == "Ram Kumar"
    assert result.vehicle_number == "DL01AB1234"
    assert result.remarks == "Full tank"
    assert result.total_amount == Decimal("950.00")
    assert len(result.items) == 1
    assert result.items[0].fuel_type == FuelType.PETROL


def test_ocr_review_confidence_threshold_blocks_ready_to_save():
    service = OCRReviewService()

    high_conf = service.review(_make_ocr_result(confidence=0.85))
    assert high_conf.ready_to_save is True
    assert high_conf.validation.errors == []
    assert high_conf.validation.warnings == []

    low_conf = service.review(_make_ocr_result(confidence=0.84))
    assert low_conf.ready_to_save is False
    assert low_conf.validation.errors == []
    assert any("Low OCR confidence (84%)" in w for w in low_conf.validation.warnings)


def test_ocr_review_detects_missing_invoice_total_mismatch_and_invalid_items():
    service = OCRReviewService()
    ocr = _make_ocr_result(
        invoice_number=None,
        confidence=0.95,
        total_amount=Decimal("1050.00"),
        items=[
            OCRResultItem(
                fuel_type=FuelType.DIESEL,
                quantity_liters=Decimal("0"),
                rate_per_liter=Decimal("100.00"),
                total_amount=Decimal("1000.00"),
            )
        ],
    )

    review = service.review(ocr)

    assert review.ready_to_save is False
    assert any("Quantity must be greater than zero" in e for e in review.validation.errors)
    assert "Invoice number missing." in review.validation.warnings
    assert "Calculated total differs from invoice total." in review.validation.warnings


def test_ocr_validator_checks_single_item_totals():
    valid = _make_ocr_result(
        fuel_type=FuelType.DIESEL,
        quantity_liters=Decimal("10.00"),
        rate_per_liter=Decimal("90.00"),
        total_amount=Decimal("900.00"),
    )
    assert OCRValidator.validate(valid) == []

    invalid = _make_ocr_result(
        invoice_number=None,
        fuel_type=FuelType.DIESEL,
        quantity_liters=Decimal("10.00"),
        rate_per_liter=Decimal("90.00"),
        total_amount=Decimal("950.00"),
    )
    errors = OCRValidator.validate(invalid)
    assert "Invoice number is missing." in errors
    assert "Total amount does not match quantity × rate." in errors


@pytest.mark.anyio
async def test_vision_service_falls_back_to_next_provider_on_failure(tmp_path):
    img = tmp_path / "slip.jpg"
    img.write_bytes(b"fake-jpeg-bytes")

    gemini_mock = MagicMock()
    gemini_mock.extract_data_from_bytes = AsyncMock(
        side_effect=OCRProviderException("Gemini quota exceeded")
    )

    expected_extraction = OCRExtraction(
        invoice_number="INV-FB-1",
        total_amount=Decimal("500.00"),
        confidence=0.91,
        items=[
            OCRExtractionItem(
                fuel_type=FuelType.PETROL,
                quantity_liters=Decimal("5.00"),
                rate_per_liter=Decimal("100.00"),
                total_amount=Decimal("500.00"),
            )
        ],
    )
    groq_mock = MagicMock()
    groq_mock.extract_data_from_bytes = AsyncMock(return_value=expected_extraction)

    openrouter_mock = MagicMock()
    openrouter_mock.extract_data_from_bytes = AsyncMock()

    with (
        patch("app.services.vision_service.settings") as mock_settings,
        patch("app.services.vision_service.GeminiProvider", return_value=gemini_mock),
        patch("app.services.vision_service.GroqProvider", return_value=groq_mock),
        patch("app.services.vision_service.OpenRouterProvider", return_value=openrouter_mock),
    ):
        mock_settings.AI_PROVIDER = "GEMINI"
        mock_settings.GOOGLE_API_KEY = "test-google-key"
        mock_settings.GROQ_API_KEY = "test-groq-key"
        mock_settings.OPENROUTER_API_KEY = "test-or-key"

        service = VisionService()
        service.preprocessor.preprocess_to_bytes = MagicMock(
            return_value=(b"processed-bytes", "image/jpeg")
        )

        result = await service.extract(str(img))

    assert result.provider == AIProvider.GROQ
    assert result.invoice_number == "INV-FB-1"
    assert result.total_amount == Decimal("500.00")
    gemini_mock.extract_data_from_bytes.assert_awaited_once()
    groq_mock.extract_data_from_bytes.assert_awaited_once()
    openrouter_mock.extract_data_from_bytes.assert_not_called()
