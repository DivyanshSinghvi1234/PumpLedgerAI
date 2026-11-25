import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OCRReviewForm from "@/features/review/components/OCRReviewForm";

vi.mock("@/features/vouchers/hooks/useCreateVoucher", () => ({
  useCreateVoucher: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/features/customers/components/CustomerAutocomplete", () => ({
  default: ({ value }: { value: string }) => (
    <input aria-label="Customer" defaultValue={value} readOnly />
  ),
}));

vi.mock("@/features/vehicles/components/VehicleAutocomplete", () => ({
  default: ({ value }: { value: string }) => (
    <input aria-label="Vehicle" defaultValue={value} readOnly />
  ),
}));

vi.mock("@/components/forms/FormDatePicker", () => ({
  default: ({ value }: { value: string }) => (
    <input aria-label="Invoice Date" defaultValue={value} readOnly />
  ),
}));

describe("OCRReviewForm", () => {
  it("renders extracted OCR fields and low-confidence warnings", () => {
    const mockData = {
      ocr: {
        invoice_number: "HP/2026/0099",
        invoice_date: "2026-09-27",
        vehicle_number: "RJ14AB1234",
        customer_name: "Sharma Logistics",
        payment_mode: "CREDIT",
        total_amount: 1000,
        confidence: 0.72,
        image_path: null,
        items: [
          {
            fuel_type: "DIESEL",
            quantity_liters: 10,
            rate_per_liter: 100,
            total_amount: 1000,
          },
        ],
      },
      validation: {
        warnings: ["Low OCR confidence (72%). Please verify fields manually."],
        errors: [],
      },
      ready_to_save: false,
    };

    render(
      <MemoryRouter>
        <OCRReviewForm data={mockData} />
      </MemoryRouter>
    );

    expect(screen.getByDisplayValue("HP/2026/0099")).toBeInTheDocument();
    expect(screen.getByText(/Low OCR confidence \(72%\)/i)).toBeInTheDocument();
  });
});
