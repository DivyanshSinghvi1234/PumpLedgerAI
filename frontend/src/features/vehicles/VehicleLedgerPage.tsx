import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

import api from "@/api/client";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { getTodayDateString } from "@/lib/utils";

import InvoiceImageDialog from "@/features/vouchers/components/InvoiceImageDialog";
import { VoucherPaymentStatusBadge } from "@/features/vouchers/components/VoucherStatusBadge";
import { invoiceImageUrl } from "@/features/vouchers/utils/invoiceImage";

import { useVehicleLedger } from "./hooks/useVehicleLedger";

function formatMoney(value: number | string): string {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function VehicleLedgerPage() {
  const { vehicleUuid = "" } = useParams();
  const queryClient = useQueryClient();
  const [showPayBox, setShowPayBox] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"CASH" | "UPI" | "BANK" | "CARD">("BANK");
  const [payBankUuid, setPayBankUuid] = useState("");
  const [payRef, setPayRef] = useState("");

  const {
    data,
    isLoading,
    isError,
  } = useVehicleLedger(vehicleUuid);

  const vehiclePayMutation = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const res = await api.post("/v1/payments/allocate-fifo", {
        customer_uuid: data.customer_uuid,
        vehicle_uuid: vehicleUuid,
        amount: Number(payAmount),
        payment_mode: payMode,
        bank_account_uuid: payMode !== "CASH" && payBankUuid ? payBankUuid : null,
        payment_date: getTodayDateString(),
        reference_number: payRef.trim() || null,
        remarks: `Vehicle settlement (${data.vehicle_number})`,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Payment recorded for ${data?.vehicle_number} and synced!`);
      setShowPayBox(false);
      setPayAmount("");
      setPayRef("");
      queryClient.invalidateQueries({ queryKey: ["vehicle-ledger", vehicleUuid] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to settle vehicle dues.");
    },
  });

  const [imageVoucher, setImageVoucher] = useState<{
    url: string | null;
    invoice: string;
  } | null>(null);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    return <EmptyState message="Unable to load vehicle ledger." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Vehicle Ledger — ${data.vehicle_number}`}
        description={`Fuel history for ${data.customer_name}.`}
        action={
          <div className="flex items-center gap-3">
            {Number(data.outstanding) > 0 && (
              <button
                type="button"
                onClick={() => {
                  setPayAmount(String(Number(data.outstanding).toFixed(2)));
                  setShowPayBox((s) => !s);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5" />
                Receive Payment for {data.vehicle_number}
              </button>
            )}
            <Link
              to="/dashboard/vehicles"
              className="rounded-md border px-4 py-2"
            >
              Back
            </Link>

            <Link
              to={`/dashboard/customers/${data.customer_uuid}/ledger`}
              className="rounded-md border px-4 py-2"
            >
              Customer Ledger
            </Link>
          </div>
        }
      />

      {showPayBox && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold">
            Settle {data.vehicle_number} Dues (FIFO → Customer Ledger + Bank)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Mode</label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value as any)}
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs"
              >
                <option value="BANK">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            {payMode !== "CASH" ? (
              <BankAccountSelect
                value={payBankUuid}
                onChange={setPayBankUuid}
                label="Credited Bank (HDFC/SBI)"
              />
            ) : (
              <div />
            )}
            <button
              type="button"
              disabled={!payAmount || Number(payAmount) <= 0 || vehiclePayMutation.isPending}
              onClick={() => vehiclePayMutation.mutate()}
              className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {vehiclePayMutation.isPending ? "Recording..." : "Confirm Payment"}
            </button>
          </div>
        </div>
      )}

      {/* Outstanding summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer
          </p>
          <p className="mt-1 text-lg font-semibold">
            {data.customer_name}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vouchers
          </p>
          <p className="mt-1 text-lg font-semibold">
            {data.voucher_count}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Outstanding
          </p>
          <p className="mt-1 text-lg font-semibold text-blue-600">
            ₹{formatMoney(data.outstanding)}
          </p>
        </div>
      </div>

      {data.vouchers.length === 0 ? (
        <EmptyState message="No vouchers for this vehicle yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fuel
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Paid
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Balance
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invoice Image
                </th>
              </tr>
            </thead>

            <tbody>
              {data.vouchers.map((v) => {
                const url = invoiceImageUrl(v.image_path);

                return (
                  <tr
                    key={v.uuid}
                    className="border-t border-border"
                  >
                    <td className="px-4 py-3 font-medium">
                      {v.invoice_number}
                      {v.is_amount_mismatch && (
                        <span
                          title="Line total doesn't match quantity × rate"
                          className="ml-1.5 text-amber-500"
                        >
                          ⚠️
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{v.invoice_date}</td>
                    <td className="px-4 py-3">{v.fuel_type}</td>
                    <td className="px-4 py-3 text-right">
                      ₹{formatMoney(v.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ₹{formatMoney(v.amount_paid)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₹{formatMoney(v.balance_due)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <VoucherPaymentStatusBadge
                        status={v.payment_status}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {url ? (
                        <button
                          type="button"
                          onClick={() =>
                            setImageVoucher({
                              url,
                              invoice: v.invoice_number,
                            })
                          }
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <InvoiceImageDialog
        open={imageVoucher !== null}
        onOpenChange={(open) => {
          if (!open) setImageVoucher(null);
        }}
        imageUrl={imageVoucher?.url ?? null}
        invoiceNumber={imageVoucher?.invoice}
      />
    </div>
  );
}
