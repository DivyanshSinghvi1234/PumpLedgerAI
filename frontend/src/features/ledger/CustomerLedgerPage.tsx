import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MessageCircle, QrCode, Copy } from "lucide-react";
import { toast } from "sonner";

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


