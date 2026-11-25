import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VoucherSuggestionBanner from "@/features/vouchers/components/VoucherSuggestionBanner";

describe("VoucherSuggestionBanner", () => {
  it("renders auto-fill badges, anomaly warnings, and fuzzy customer apply chips", () => {
    const onPick = vi.fn();

    render(
      <VoucherSuggestionBanner
        autoAppliedNotes={["Customer: Sharma Transport", "Rate: ₹89.5"]}
        onPickFuzzyCustomer={onPick}
        suggestion={{
          normalized_vehicle_number: "HR26BR9080",
          vehicle_uuid: "veh-1",
          customer_uuid: "cust-1",
          customer_name: "Sharma Transport",
          customer_confidence: 0.95,
          fuel_type: "DIESEL",
          fuel_type_confidence: 1.0,
          rate_per_liter: 89.5,
          payment_mode: "CREDIT",
          payment_mode_confidence: 1.0,
          vehicle_avg_quantity: 45,
          vehicle_sample_count: 8,
          warnings: [
            {
              type: "UNUSUAL_QUANTITY",
              message: "Quantity 350 L is unusual for HR26BR9080.",
              candidates: [],
            },
            {
              type: "FUZZY_CUSTOMER_MATCH",
              message: "Did you mean 'Sharma Transport Pvt Ltd'?",
              candidates: [
                {
                  customer_uuid: "cust-99",
                  customer_name: "Sharma Transport Pvt Ltd",
                  score: 0.91,
                },
              ],
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/Customer: Sharma Transport/i)).toBeInTheDocument();
    expect(screen.getByText(/Vehicle avg: 45 L \(8 fills\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Quantity 350 L is unusual/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sharma Transport Pvt Ltd/i }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ customer_uuid: "cust-99" })
    );
  });
});
