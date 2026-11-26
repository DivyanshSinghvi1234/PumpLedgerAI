import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, QrCode, Copy, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "@/api/client";
import voucherService from "@/features/vouchers/services/voucherService";
import ReceivePaymentDialog from "@/features/payments/components/ReceivePaymentDialog";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { getWhatsAppShareUrl } from "@/lib/whatsapp";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import LedgerSummary from "./components/LedgerSummary";
import LedgerTable from "./components/LedgerTable";
import AdjustmentDialog from "./components/AdjustmentDialog";
import ReconciliationDialog from "./components/ReconciliationDialog";
import { useCustomerLedger } from "./hooks/useCustomerLedger";
import AuditTimelineDialog from "@/components/common/AuditTimelineDialog";

import { History } from "lucide-react";

export default function CustomerLedgerPage() {
  const { customerUuid = "" } = useParams();

  const { hasRole, activePump } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [upiOpen, setUpiOpen] = useState(false);
  const [upiId, setUpiId] = useState(() => localStorage.getItem("pump_upi_id") || "");
  const [selectedVoucherUuids, setSelectedVoucherUuids] = useState<string[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [isSettlingBatch, setIsSettlingBatch] = useState(false);
  const queryClient = useQueryClient();

  const { data: unpaidVouchersData } = useQuery({
    queryKey: ["customer-unpaid-vouchers", customerUuid],
    queryFn: () =>
      voucherService.getVouchers({
        customer_uuid: customerUuid,
        payment_status: "UNPAID",
        page_size: 50,
      }),
    enabled: Boolean(customerUuid),
  });

  const unpaidVouchers = unpaidVouchersData?.items ?? [];
  const selectedTotal = unpaidVouchers
    .filter((v) => selectedVoucherUuids.includes(v.uuid))
    .reduce((sum, v) => sum + Number(v.balance_due ?? v.total_amount ?? 0), 0);

  const handleZeroOutRoundOff = async () => {
    if (!data) return;
    const bal = Number(data.closing_balance);
    if (bal <= 0 || bal > 10) return;
    try {
      await api.post(`/v1/ledger/customer/${customerUuid}/adjustment`, {
        entry_type: "CREDIT_ADJUSTMENT",
        amount: bal,
        remarks: "Round-off / small paisa write-off",
      });
      toast.success(`Written off ₹${bal.toFixed(2)} round-off.`);
      queryClient.invalidateQueries({ queryKey: ["customerLedger", customerUuid] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to write off round-off.");
    }
  };

  const handlePaySelectedBills = async () => {
    if (selectedVoucherUuids.length === 0) return;
    setIsSettlingBatch(true);
    try {
      for (const vUuid of selectedVoucherUuids) {
        const v = unpaidVouchers.find((x) => x.uuid === vUuid);
        if (!v) continue;
        await api.post(`/v1/vouchers/${vUuid}/settle`, {
          amount: Number(v.balance_due ?? v.total_amount),
          payment_mode: "CASH",
          payment_date: new Date().toISOString().split("T")[0],
          remarks: `Selected bill settlement #${v.invoice_number}`,
        });
      }
      toast.success(`Settled ${selectedVoucherUuids.length} selected bill(s)!`);
      setSelectedVoucherUuids([]);
      queryClient.invalidateQueries({ queryKey: ["customer-unpaid-vouchers", customerUuid] });
      queryClient.invalidateQueries({ queryKey: ["customerLedger", customerUuid] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to settle selected bills.");
    } finally {
      setIsSettlingBatch(false);
    }
  };

  const openStatementWithPreset = (preset: "this_month" | "last_month" | "last_7" | "unpaid") => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    let params = "";
    if (preset === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      params = `?from=${fmt(start)}&to=${fmt(now)}`;
    } else if (preset === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      params = `?from=${fmt(start)}&to=${fmt(end)}`;
    } else if (preset === "last_7") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      params = `?from=${fmt(start)}&to=${fmt(now)}`;
    } else {
      params = "?unpaid=1";
    }
    window.open(`/statement/${customerUuid}${params}`, "_blank");
  };

  const {
    data,
    isLoading,
    isError,
  } = useCustomerLedger(customerUuid, {
    page,
    page_size: 20,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    return (
      <EmptyState message="Unable to load ledger." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ledger — ${data.customer_name}`}
        description="Customer account statement."
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/customers"
              className="rounded-md border px-4 py-2 hover:bg-muted/10 transition-colors"
            >
              Back
            </Link>

            <button
              onClick={() => setAuditOpen(true)}
              className="rounded-md border px-3 py-2 hover:bg-muted/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-ink"
              title="View change history timeline"
            >
              <History size={15} className="text-fuel-amber" /> Audit History
            </button>

            <div className="flex items-center gap-1 rounded-md border border-hairline bg-surface-2 p-0.5 text-[11px]">
              <button type="button" onClick={() => openStatementWithPreset("this_month")} className="px-2 py-1 rounded hover:bg-surface-3 cursor-pointer">This Month</button>
              <button type="button" onClick={() => openStatementWithPreset("last_month")} className="px-2 py-1 rounded hover:bg-surface-3 cursor-pointer">Last Month</button>
              <button type="button" onClick={() => openStatementWithPreset("last_7")} className="px-2 py-1 rounded hover:bg-surface-3 cursor-pointer">7 Days</button>
              <button type="button" onClick={() => openStatementWithPreset("unpaid")} className="px-2 py-1 rounded hover:bg-surface-3 cursor-pointer">All Unpaid</button>
            </div>

            {canManage && Number(data.closing_balance) > 0 && (
              <button
                type="button"
                onClick={() => setPayDialogOpen(true)}
                className="rounded-md bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-2 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 size={14} />
                Settle Full Due ({formatCurrency(data.closing_balance)})
              </button>
            )}

            {canManage && Number(data.closing_balance) > 0 && Number(data.closing_balance) <= 5 && (
              <button
                type="button"
                onClick={handleZeroOutRoundOff}
                className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 px-3 py-2 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <Sparkles size={14} />
                Write Off Round-Off ({formatCurrency(data.closing_balance)})
              </button>
            )}

            <button
              onClick={() => window.open(`/statement/${customerUuid}`, "_blank")}
              className="rounded-md border px-4 py-2 hover:bg-muted/10 transition-colors cursor-pointer"
            >
              Generate Statement
            </button>

            {Number(data.closing_balance) > 0 && (
              <button
                onClick={() => setUpiOpen((v) => !v)}
                className="rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-3 py-2 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <QrCode size={15} />
                UPI Pay Link
              </button>
            )}


            <button
              onClick={() => {
                const message = `Dear ${data.customer_name}, your account balance at ${activePump?.name || "Fuel Station"} is ${formatCurrency(data.closing_balance)}. Statement link: ${window.location.origin}/statement/${customerUuid}`;
                window.open(getWhatsAppShareUrl((data as any).mobile, message), "_blank");
              }}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-4 py-2 cursor-pointer transition-colors flex items-center gap-2 font-medium"
            >
              <MessageCircle size={16} />
              WhatsApp Reminder
            </button>

            {canManage && (
              <>
                <button
                  onClick={() => setReconcileOpen(true)}
                  className="rounded-md border border-fuel-amber/30 bg-fuel-amber/10 text-fuel-amber hover:bg-fuel-amber/20 px-4 py-2 cursor-pointer transition-colors"
                >
                  Reconcile
                </button>
                <button
                  onClick={() =>
                    setDialogOpen(true)
                  }
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors"
                >
                  + Adjustment
                </button>
              </>
            )}
          </div>
        }
      />

      {upiOpen && Number(data.closing_balance) > 0 && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-ink-muted">
              Station UPI ID (saved for future statements)
            </label>
            <input
              placeholder="e.g. pump@hdfcbank"
              value={upiId}
              onChange={(e) => {
                setUpiId(e.target.value);
                localStorage.setItem("pump_upi_id", e.target.value);
              }}
              className="w-full max-w-xs rounded-md border border-hairline bg-card px-3 py-1.5 text-xs font-mono"
            />
          </div>
          {upiId.trim() && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(activePump?.name || "Fuel Station")}&am=${Number(data.closing_balance).toFixed(2)}&cu=INR`;
                  navigator.clipboard.writeText(upiLink);
                  toast.success("UPI payment link copied!");
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                <Copy size={13} />
                Copy UPI Link ({formatCurrency(data.closing_balance)})
              </button>
              <button
                type="button"
                onClick={() => {
                  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(activePump?.name || "Fuel Station")}&am=${Number(data.closing_balance).toFixed(2)}&cu=INR`;
                  const msg = `Dear ${data.customer_name}, please pay ${formatCurrency(data.closing_balance)} via UPI: ${upiLink} | Statement: ${window.location.origin}/statement/${customerUuid}`;
                  window.open(getWhatsAppShareUrl((data as any).mobile, msg), "_blank");
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                <MessageCircle size={13} />
                Send via WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      <LedgerSummary
        customerName={data.customer_name}
        openingBalance={data.opening_balance}
        closingBalance={data.closing_balance}
      />

      {/* Select & Pay Specific Unpaid Bills */}
      {canManage && unpaidVouchers.length > 0 && (
        <div className="rounded-xl border border-hairline bg-surface-1 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink">
                Select &amp; Pay Specific Bills ({unpaidVouchers.length} Unpaid)
              </h3>
              <p className="text-[11px] text-ink-muted">
                Tick specific invoices to settle them together instead of strict FIFO.
              </p>
            </div>
            {selectedVoucherUuids.length > 0 && (
              <button
                type="button"
                disabled={isSettlingBatch}
                onClick={handlePaySelectedBills}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                {isSettlingBatch
                  ? "Settling..."
                  : `Pay Selected (${selectedVoucherUuids.length} · ${formatCurrency(selectedTotal)})`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {unpaidVouchers.map((v) => {
              const checked = selectedVoucherUuids.includes(v.uuid);
              return (
                <label
                  key={v.uuid}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition ${
                    checked ? "border-emerald-500 bg-emerald-500/10" : "border-hairline bg-surface-2"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedVoucherUuids((prev) =>
                          prev.includes(v.uuid) ? prev.filter((id) => id !== v.uuid) : [...prev, v.uuid]
                        )
                      }
                    />
                    <div>
                      <div className="font-mono font-semibold text-ink">#{v.invoice_number}</div>
                      <div className="text-[10px] text-ink-muted">{v.invoice_date}</div>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-rose-500">
                    {formatCurrency(v.balance_due ?? v.total_amount)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <LedgerTable entries={data.items} />

      <div className="flex items-center justify-end gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-3 py-2 disabled:opacity-50"
        >
          Previous
        </button>

        <span>
          Page {page} of{" "}
          {data.pagination.total_pages}
        </span>

        <button
          disabled={
            page >= data.pagination.total_pages
          }
          onClick={() => setPage((p) => p + 1)}
          className="rounded border px-3 py-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {canManage && (
        <>
          <AdjustmentDialog
            open={dialogOpen}
            customerUuid={customerUuid}
            onOpenChange={setDialogOpen}
          />
          <ReconciliationDialog
            open={reconcileOpen}
            customerUuid={customerUuid}
            customerName={data.customer_name}
            onOpenChange={setReconcileOpen}
          />
          <ReceivePaymentDialog
            open={payDialogOpen}
            onOpenChange={setPayDialogOpen}
            customerOptions={[{ label: data.customer_name, value: customerUuid }]}
          />
        </>
      )}

      <AuditTimelineDialog
        open={auditOpen}
        onOpenChange={setAuditOpen}
        title={`Audit History — ${data.customer_name}`}
        targetTable="customers"
        targetId={customerUuid}
      />
    </div>
  );
}


