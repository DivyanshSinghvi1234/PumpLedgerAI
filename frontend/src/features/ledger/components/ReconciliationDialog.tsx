import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormTextarea from "@/components/forms/FormTextarea";
import FormDatePicker from "@/components/forms/FormDatePicker";
import FormActions from "@/components/forms/FormActions";

import { useVoucherList } from "@/features/vouchers/hooks/useVoucherList";
import api, { extractApiError } from "@/api/client";
import { formatCurrency, getTodayDateString } from "@/lib/utils";

interface Props {
  open: boolean;
  customerUuid: string;
  customerName?: string;
  onOpenChange(open: boolean): void;
}

const PAYMENT_MODES = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
];

export default function ReconciliationDialog({
  open,
  customerUuid,
  customerName = "Customer",
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();

  // Form fields state
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Table selections
  const [selectedVouchers, setSelectedVouchers] = useState<Record<string, boolean>>({});
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  // Fetch all CREDIT vouchers for the customer
  const { data: vouchersData, isLoading: isLoadingVouchers } = useVoucherList({
    customer_uuid: customerUuid,
    payment_mode: "CREDIT",
    page_size: 500, // Load up to 500 credit vouchers to ensure comprehensive matching
  });

  const unpaidVouchers = vouchersData?.items.filter(
    (v) => v.payment_status !== "PAID"
  ) || [];

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPaymentAmount("");
      setPaymentDate(getTodayDateString());
      setPaymentMode("CASH");
      setReferenceNumber("");
      setRemarks("");
      setSelectedVouchers({});
      setAllocations({});
    }
  }, [open]);

  // Handle checkboxes
  const handleToggleVoucher = (voucherUuid: string, balanceDue: number) => {
    setSelectedVouchers((prev) => {
      const nextChecked = !prev[voucherUuid];
      const updated = { ...prev, [voucherUuid]: nextChecked };

      // Auto-fill allocation when checked
      if (nextChecked) {
        // Calculate remaining amount that can be allocated
        const totalPayment = parseFloat(paymentAmount) || 0;
        const currentAllocated = Object.entries(allocations).reduce(
          (sum, [uuid, amt]) => {
            if (uuid === voucherUuid || !updated[uuid]) return sum;
            return sum + (parseFloat(amt) || 0);
          },
          0
        );
        const remainingPayment = Math.max(0, totalPayment - currentAllocated);
        const autoFillAmount = Math.min(balanceDue, remainingPayment);

        setAllocations((prevAlloc) => ({
          ...prevAlloc,
          [voucherUuid]: autoFillAmount > 0 ? autoFillAmount.toFixed(2) : "",
        }));
      } else {
        // Clear allocation when unchecked
        setAllocations((prevAlloc) => {
          const nextAlloc = { ...prevAlloc };
          delete nextAlloc[voucherUuid];
          return nextAlloc;
        });
      }

      return updated;
    });
  };

  const handleAllocationChange = (voucherUuid: string, value: string) => {
    setAllocations((prev) => ({
      ...prev,
      [voucherUuid]: value,
    }));
  };

  // Mutation to submit payment allocation
  const allocateMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post("/v1/payments/allocate", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger", customerUuid] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-outstanding"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment reconciled and allocated successfully.");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, "Failed to reconcile payment."));
    },
  });

  // Calculate totals
  const totalAmt = parseFloat(paymentAmount) || 0;
  const totalAllocated = Object.entries(allocations).reduce(
    (sum, [uuid, amt]) => {
      if (!selectedVouchers[uuid]) return sum;
      return sum + (parseFloat(amt) || 0);
    },
    0
  );
  const unallocatedAmount = totalAmt - totalAllocated;

  // Validation checks
  const hasSelected = Object.values(selectedVouchers).some(Boolean);
  const isValidAmounts = Object.entries(allocations).every(([uuid, amtStr]) => {
    if (!selectedVouchers[uuid]) return true;
    const val = parseFloat(amtStr);
    const voucher = unpaidVouchers.find((v) => v.uuid === uuid);
    if (!voucher) return false;
    return val > 0 && val <= voucher.balance_due;
  });

  const isMatchingTotal = Math.abs(unallocatedAmount) < 0.01;
  const isSubmitDisabled =
    !paymentAmount ||
    totalAmt <= 0 ||
    !hasSelected ||
    !isValidAmounts ||
    !isMatchingTotal ||
    allocateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    const payload = {
      customer_uuid: customerUuid,
      amount: totalAmt,
      payment_mode: paymentMode,
      payment_date: paymentDate,
      reference_number: referenceNumber || null,
      remarks: remarks || null,
      allocations: Object.entries(allocations)
        .filter(([uuid]) => selectedVouchers[uuid])
        .map(([uuid, amtStr]) => ({
          voucher_uuid: uuid,
          amount: parseFloat(amtStr),
        })),
    };

    allocateMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-card p-6 shadow-xl max-h-[90vh] flex flex-col">
        <DialogTitle className="text-xl font-semibold border-b pb-4">
          Bill-by-Bill Reconciliation — {customerName}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              type="number"
              step="0.01"
              label="Payment Amount (₹)"
              required
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="e.g. 5000"
            />
            <FormDatePicker
              label="Payment Date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
            <FormSelect
              label="Payment Mode"
              options={PAYMENT_MODES}
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              type="text"
              label="Reference / Transaction Number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. UPI Ref, Chq #"
            />
            <FormTextarea
              label="Remarks"
              rows={1}
              className="py-2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Allocation details..."
            />
          </div>

          <div className="flex-1 overflow-y-auto border rounded-xl p-4 bg-muted/20">
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">
              Unpaid Credit Invoices
            </h3>

            {isLoadingVouchers ? (
              <div className="py-8 text-center text-sm text-ink-muted animate-pulse">
                Loading unpaid invoices...
              </div>
            ) : unpaidVouchers.length === 0 ? (
              <div className="py-8 text-center text-sm text-ink-muted">
                No unpaid or partially paid credit invoices found for this client.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      <th className="py-2 px-3 w-10">Select</th>
                      <th className="py-2 px-3">Invoice No</th>
                      <th className="py-2 px-3">Invoice Date</th>
                      <th className="py-2 px-3 text-right">Total (₹)</th>
                      <th className="py-2 px-3 text-right">Balance Due (₹)</th>
                      <th className="py-2 px-3 text-right w-40">Allocation (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unpaidVouchers.map((voucher) => {
                      const isChecked = !!selectedVouchers[voucher.uuid];
                      return (
                        <tr
                          key={voucher.uuid}
                          className={`border-b transition-colors ${
                            isChecked ? "bg-fuel-amber/5" : "hover:bg-muted/10"
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 text-fuel-amber focus:ring-fuel-amber cursor-pointer"
                              checked={isChecked}
                              onChange={() =>
                                handleToggleVoucher(voucher.uuid, voucher.balance_due)
                              }
                            />
                          </td>
                          <td className="py-2.5 px-3 font-medium text-ink">
                            {voucher.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 text-ink-muted text-xs">
                            {new Date(voucher.invoice_date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs">
                            {formatCurrency(voucher.total_amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold font-mono text-xs text-error">
                            {formatCurrency(voucher.balance_due)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!isChecked}
                              className="w-full text-right text-xs rounded-lg border border-hairline bg-surface px-2.5 py-1.5 font-mono text-ink outline-none transition disabled:bg-muted/30 focus:border-fuel-amber/50"
                              value={allocations[voucher.uuid] || ""}
                              placeholder="0.00"
                              onChange={(e) =>
                                handleAllocationChange(voucher.uuid, e.target.value)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center bg-muted/40 p-4 rounded-xl border border-hairline gap-4 text-xs">
            <div className="flex gap-6">
              <div>
                <span className="text-ink-muted">Total Amount:</span>{" "}
                <span className="font-bold text-sm font-mono text-ink">
                  {formatCurrency(totalAmt)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Allocated:</span>{" "}
                <span className="font-bold text-sm font-mono text-success">
                  {formatCurrency(totalAllocated)}
                </span>
              </div>
              <div>
                <span className="text-ink-muted">Remaining:</span>{" "}
                <span
                  className={`font-bold text-sm font-mono ${
                    isMatchingTotal ? "text-success" : "text-error animate-pulse"
                  }`}
                >
                  {formatCurrency(unallocatedAmount)}
                </span>
              </div>
            </div>

            {!isMatchingTotal && totalAmt > 0 && (
              <span className="text-error font-medium">
                ⚠️ Remaining amount must be exactly 0.00
              </span>
            )}
          </div>

          <FormActions
            loading={allocateMutation.isPending}
            onCancel={() => onOpenChange(false)}
            submitLabel="Reconcile & Settle"
            disabled={isSubmitDisabled}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
