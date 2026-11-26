import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import UpiAccountSelect from "@/components/common/UpiAccountSelect";
import paymentService from "../services/paymentService";
import { getTodayDateString } from "@/lib/utils";
import type { PaymentMode } from "../types/payment";

interface BulkRow {
  id: string;
  customer_name: string;
  customer_uuid: string;
  amount: string;
  payment_mode: Extract<PaymentMode, "CASH" | "UPI" | "BANK">;
  bank_account_uuid: string;
  upi_uuid: string;
  reference_number: string;
}

const makeRow = (): BulkRow => ({
  id: `${Date.now()}-${Math.random()}`,
  customer_name: "",
  customer_uuid: "",
  amount: "",
  payment_mode: "BANK",
  bank_account_uuid: "",
  upi_uuid: "",
  reference_number: "",
});

interface BulkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkPaymentDialog({ open, onOpenChange }: BulkPaymentDialogProps) {
  const queryClient = useQueryClient();
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [rows, setRows] = useState<BulkRow[]>(() => [makeRow(), makeRow()]);
  const [submitting, setSubmitting] = useState(false);

  const updateRow = (id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.customer_uuid && Number(r.amount) > 0);
    if (validRows.length === 0) {
      toast.error("Add at least one row with a Customer and Amount > 0.");
      return;
    }

    setSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (const r of validRows) {
      try {
        await paymentService.createPayment({
          customer_uuid: r.customer_uuid,
          amount: Number(r.amount),
          payment_mode: r.payment_mode,
          bank_account_uuid: r.payment_mode !== "CASH" && r.bank_account_uuid ? r.bank_account_uuid : null,
          payment_date: paymentDate,
          reference_number: r.reference_number.trim() || null,
          remarks: "Bulk payment entry",
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });

    if (successCount > 0) {
      toast.success(`Posted ${successCount} payment(s) successfully!`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} payment(s) failed — please review.`);
    } else {
      setRows([makeRow(), makeRow()]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border border-hairline sm:max-w-[760px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-ink">
            Bulk Payment Entry (Multi-Customer FIFO Settlement)
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-muted">
            Record multiple customer collections at once. Each row settles that customer&apos;s oldest unpaid invoices and updates Cash / Bank automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-muted">Payment Date:</span>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-40 h-8 text-xs"
                required
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRows((prev) => [...prev, makeRow()])}
              className="h-8 text-xs cursor-pointer"
            >
              <Plus size={13} className="mr-1" /> Add Row
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((r, idx) => (
              <div key={r.id} className="rounded-lg border border-hairline bg-surface-2/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-ink-subtle">Row #{idx + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      className="text-rose-400 hover:text-rose-500 cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <CustomerAutocomplete
                      value={r.customer_name}
                      customerUuid={r.customer_uuid || null}
                      onChange={(name, uuid) =>
                        updateRow(r.id, { customer_name: name, customer_uuid: uuid ?? "" })
                      }
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount (₹)"
                      value={r.amount}
                      onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <select
                      value={r.payment_mode}
                      onChange={(e) =>
                        updateRow(r.id, {
                          payment_mode: e.target.value as "CASH" | "UPI" | "BANK",
                        })
                      }
                      className="w-full h-9 rounded-md border border-hairline bg-surface-2 px-2.5 text-xs text-ink"
                    >
                      <option value="BANK">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>
                </div>
                {r.payment_mode !== "CASH" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {r.payment_mode === "UPI" && (
                      <UpiAccountSelect
                        value={r.upi_uuid}
                        label=""
                        onChange={(u, linkedBank, acc) =>
                          updateRow(r.id, {
                            upi_uuid: u,
                            bank_account_uuid: linkedBank || r.bank_account_uuid,
                            reference_number:
                              !r.reference_number && acc ? `${acc.provider}:${acc.name}` : r.reference_number,
                          })
                        }
                      />
                    )}
                    <BankAccountSelect
                      value={r.bank_account_uuid}
                      label=""
                      onChange={(uuid) => updateRow(r.id, { bank_account_uuid: uuid })}
                    />
                    <Input
                      placeholder="UTR / Reference (optional)"
                      value={r.reference_number}
                      onChange={(e) => updateRow(r.id, { reference_number: e.target.value })}
                      className="h-9 text-xs"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs h-9">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9"
            >
              {submitting ? "Posting Payments..." : "Post All Payments"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
