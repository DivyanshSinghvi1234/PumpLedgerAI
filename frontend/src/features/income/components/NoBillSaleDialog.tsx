import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormDatePicker from "@/components/forms/FormDatePicker";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import { getTodayDateString } from "@/lib/utils";
import { Trash2, Plus } from "lucide-react";

import { useCreateNoBillSale } from "../hooks/useCreateNoBillSale";
import type { FuelType, PaymentMode } from "../types/income";
import type { CreateVoucherRequest } from "@/types/voucher";

// Enum values mirror the backend (app/core/enums.py).
const FUEL_OPTIONS: { label: string; value: FuelType }[] = [
  { label: "Petrol", value: "PETROL" },
  { label: "Speed", value: "SPEED" },
  { label: "Diesel", value: "DIESEL" },
  { label: "Lubricant", value: "LUBRICANT" },
];

const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Credit", value: "CREDIT" },
];

interface FuelLine {
  fuel_type: FuelType;
  quantity: string;
  rate: string;
}

function emptyLine(): FuelLine {
  return { fuel_type: "PETROL", quantity: "", rate: "" };
}

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Prefill the date with the day currently being viewed. */
  defaultDate: string;
}

/**
 * Record a fuel sale that has no printed bill. Under the hood this creates a
 * Voucher (multiple fuel items + customer link + payment mode), so it lands in
 * the customer section / ledger exactly like a normal sale. Payment mode is
 * required — a CREDIT sale posts to the customer's outstanding balance, while
 * CASH/UPI/CARD settle immediately.
 */
export default function NoBillSaleDialog({
  open,
  onOpenChange,
  defaultDate,
}: Props) {
  const createMutation = useCreateNoBillSale();

  const [saleDate, setSaleDate] = useState(defaultDate || getTodayDateString());
  const [customerName, setCustomerName] = useState("");
  const [customerUuid, setCustomerUuid] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [lines, setLines] = useState<FuelLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSaleDate(defaultDate || getTodayDateString());
      setCustomerName("");
      setCustomerUuid(null);
      setPaymentMode("CASH");
      setLines([emptyLine()]);
      setError(null);
    } else {
      createMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  function updateLine(index: number, patch: Partial<FuelLine>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  // Per-line amount = qty × rate; grand total drives the voucher total.
  const lineAmounts = useMemo(
    () =>
      lines.map((line) => {
        const qty = Number(line.quantity) || 0;
        const rate = Number(line.rate) || 0;
        return qty * rate;
      }),
    [lines]
  );

  const grandTotal = useMemo(
    () => lineAmounts.reduce((sum, amount) => sum + amount, 0),
    [lineAmounts]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError("Customer name is required.");
      return;
    }

    const items = lines
      .map((line, i) => ({
        fuel_type: line.fuel_type,
        quantity_liters: Number(line.quantity) || 0,
        rate_per_liter: Number(line.rate) || 0,
        total_amount: Number(lineAmounts[i].toFixed(2)),
      }))
      .filter((item) => item.quantity_liters > 0 && item.rate_per_liter > 0);

    if (items.length === 0) {
      setError("Add at least one fuel line with quantity and rate.");
      return;
    }

    // Auto-generate an invoice number — a no-bill sale has no printed number,
    // but Voucher requires a unique one. NB- prefix + timestamp keeps it unique
    // and marks its origin. ponytail: not human-meaningful and collides only if
    // two are saved in the same millisecond; upgrade path = a per-pump sequence.
    const invoiceNumber = `NB-${Date.now()}`;

    const payload: CreateVoucherRequest = {
      invoice_number: invoiceNumber,
      invoice_date: saleDate,
      customer_name: customerName.trim(),
      customer_uuid: customerUuid,
      total_amount: Number(grandTotal.toFixed(2)),
      payment_mode: paymentMode,
      items,
      remarks: "No-bill sale (recorded from Income tab)",
    };

    await createMutation.mutateAsync(payload);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 w-full max-w-2xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          Record Sale (no bill)
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <CustomerAutocomplete
            value={customerName}
            customerUuid={customerUuid}
            onChange={(name, uuid) => {
              setCustomerName(name);
              setCustomerUuid(uuid);
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormDatePicker
              label="Sale Date"
              required
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />

            <FormSelect
              label="Payment Mode"
              options={PAYMENT_OPTIONS}
              value={paymentMode}
              onChange={(e) =>
                setPaymentMode(e.target.value as PaymentMode)
              }
            />
          </div>

          {/* Fuel lines — one row per fuel type. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Fuel Lines
              </label>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition cursor-pointer"
              >
                <Plus size={14} /> Add fuel
              </button>
            </div>

            {lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-12 items-end gap-2 rounded-xl border border-hairline bg-surface-2/50 p-3"
              >
                <div className="col-span-4">
                  <FormSelect
                    label="Fuel"
                    options={FUEL_OPTIONS}
                    value={line.fuel_type}
                    onChange={(e) =>
                      updateLine(index, {
                        fuel_type: e.target.value as FuelType,
                      })
                    }
                  />
                </div>

                <div className="col-span-3">
                  <FormInput
                    type="number"
                    step="0.001"
                    label="Qty (L)"
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(index, { quantity: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-3">
                  <FormInput
                    type="number"
                    step="0.01"
                    label="Rate"
                    value={line.rate}
                    onChange={(e) =>
                      updateLine(index, { rate: e.target.value })
                    }
                  />
                </div>

                <div className="col-span-2 flex items-center justify-between gap-1 pb-3">
                  <span className="text-sm font-semibold text-ink">
                    ₹{lineAmounts[index].toFixed(2)}
                  </span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-ink-muted hover:text-error transition cursor-pointer"
                      aria-label="Remove fuel line"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
            <span className="text-sm font-medium text-ink-muted">Total</span>
            <span className="text-lg font-bold text-ink">
              ₹{grandTotal.toFixed(2)}
            </span>
          </div>

          {error && (
            <p className="text-sm font-medium text-error">{error}</p>
          )}

          <FormActions
            loading={createMutation.isPending}
            onCancel={() => onOpenChange(false)}
            submitLabel="Record Sale"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
