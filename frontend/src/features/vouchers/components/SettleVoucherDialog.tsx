import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/api/client";
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
import { Label } from "@/components/ui/label";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import UpiAccountSelect from "@/components/common/UpiAccountSelect";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import type { Voucher } from "@/types/voucher";

interface SettleVoucherDialogProps {
  voucher: Voucher | null;
  onOpenChange: (open: boolean) => void;
}

export default function SettleVoucherDialog({
  voucher,
  onOpenChange,
}: SettleVoucherDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "CARD" | "BANK" | "SPLIT">("CASH");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitUpiAmount, setSplitUpiAmount] = useState("");
  const [bankUuid, setBankUuid] = useState("");
  const [upiUuid, setUpiUuid] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (voucher) {
      setAmount(String(voucher.balance_due || voucher.total_amount || ""));
      setPaymentMode("CASH");
      setBankUuid("");
      setUpiUuid("");
      setPaymentDate(getTodayDateString());
      setReferenceNumber("");
      setRemarks("");
    }
  }, [voucher]);

  const settleMutation = useMutation({
    mutationFn: async () => {
      if (!voucher) return;
      if (paymentMode === "SPLIT") {
        const cashPart = Number(splitCashAmount) || 0;
        const upiPart = Number(splitUpiAmount) || 0;
        if (cashPart > 0) {
          await api.post(`/v1/vouchers/${voucher.uuid}/settle`, {
            amount: cashPart,
            payment_mode: "CASH",
            bank_account_uuid: null,
            payment_date: paymentDate,
            reference_number: null,
            remarks: remarks.trim() || `Split Cash settle #${voucher.invoice_number}`,
          });
        }
        if (upiPart > 0) {
          await api.post(`/v1/vouchers/${voucher.uuid}/settle`, {
            amount: upiPart,
            payment_mode: "UPI",
            bank_account_uuid: bankUuid || null,
            payment_date: paymentDate,
            reference_number: referenceNumber.trim() || null,
            remarks: remarks.trim() || `Split UPI settle #${voucher.invoice_number}`,
          });
        }
        return;
      }
      const res = await api.post(`/v1/vouchers/${voucher.uuid}/settle`, {
        amount: Number(amount),
        payment_mode: paymentMode,
        bank_account_uuid: paymentMode !== "CASH" && bankUuid ? bankUuid : null,
        payment_date: paymentDate,
        reference_number: referenceNumber.trim() || null,
        remarks: remarks.trim() || `Settled Invoice #${voucher.invoice_number}`,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Voucher settled and ledger/bank updated!");
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to settle voucher.");
    },
  });

  return (
    <Dialog open={Boolean(voucher)} onOpenChange={onOpenChange}>
      <DialogContent className="glass border border-hairline sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-ink">
            Settle Voucher #{voucher?.invoice_number}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-muted">
            {voucher?.customer_name || "Walk-in"} · Balance Due:{" "}
            <strong className="text-fuel-amber font-mono">
              {formatCurrency(voucher?.balance_due ?? 0)}
            </strong>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!Number(amount) || Number(amount) <= 0) {
              toast.error("Enter a valid settlement amount.");
              return;
            }
            settleMutation.mutate();
          }}
          className="space-y-3 py-1"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Payment Mode</Label>
              <select
                value={paymentMode}
                onChange={(e) => {
                  const m = e.target.value as "CASH" | "UPI" | "CARD" | "BANK" | "SPLIT";
                  setPaymentMode(m);
                  if (m === "SPLIT") {
                    const tot = Number(amount) || 0;
                    setSplitCashAmount(String(tot));
                    setSplitUpiAmount("0");
                  }
                }}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink h-9"
              >
                <option value="CASH">Cash Drawer</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
                <option value="CARD">Card</option>
                <option value="SPLIT">Split (Cash + UPI)</option>
              </select>
            </div>
          </div>

          {paymentMode === "SPLIT" && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-surface-2 p-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-ink-muted">Cash Part (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={splitCashAmount}
                  onChange={(e) => {
                    const c = e.target.value;
                    setSplitCashAmount(c);
                    const rem = Math.max(0, (Number(amount) || 0) - (Number(c) || 0));
                    setSplitUpiAmount(rem.toFixed(2));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-ink-muted">UPI Part (Auto-filled)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={splitUpiAmount}
                  onChange={(e) => setSplitUpiAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          {(paymentMode === "UPI" || paymentMode === "SPLIT") && (
            <UpiAccountSelect
              value={upiUuid}
              onChange={(u, linkedBank, acc) => {
                setUpiUuid(u);
                if (linkedBank) setBankUuid(linkedBank);
                if (acc && !referenceNumber) {
                  setReferenceNumber(`${acc.provider}:${acc.name}`);
                }
              }}
            />
          )}

          {paymentMode !== "CASH" && (
            <BankAccountSelect value={bankUuid} onChange={setBankUuid} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Reference (optional)</Label>
              <Input
                placeholder="UTR / Ref #"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-xs h-9">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={settleMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
            >
              {settleMutation.isPending ? "Settling..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
