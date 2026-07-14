import { useState, useMemo } from "react";
import {
  Settings,
  Download,
  CheckCircle,
  AlertTriangle,
  FileText,
  Wallet,
  Calendar,
  Layers,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { useTallyPreview, useExportTally, useMarkTallySynced, getStoredTallyMappings, getStoredTallyVoucherTypes } from "./hooks/useTally";
import TallySettingsDialog from "./components/TallySettingsDialog";
import type { TallyExportRequest } from "./types";

// Date helpers to avoid external date-fns dependency
const getFirstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getFilenameDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

export default function TallyExportPage() {
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth());
  const [toDate, setToDate] = useState(getTodayDateString());
  const [markAsSynced, setMarkAsSynced] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"vouchers" | "payments">("vouchers");

  const [triggerRefresh, setTriggerRefresh] = useState(0);

  const mappings = useMemo(() => getStoredTallyMappings(), [triggerRefresh]);
  const voucherTypes = useMemo(() => getStoredTallyVoucherTypes(), [triggerRefresh]);

  const request: TallyExportRequest = useMemo(() => ({
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    mark_as_synced: false, // handled explicitly in export call
    ledger_mappings: mappings,
    voucher_types: voucherTypes,
  }), [fromDate, toDate, mappings, voucherTypes]);

  const { data: previewData, isLoading, isError, refetch } = useTallyPreview(request);
  const exportMutation = useExportTally();
  const markSyncedMutation = useMarkTallySynced();

  const handleExport = async () => {
    if (!previewData) return;
    const exportReq: TallyExportRequest = {
      ...request,
      mark_as_synced: markAsSynced,
    };

    try {
      const blob = await exportMutation.mutateAsync(exportReq);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tally_import_${getFilenameDateString()}.xml`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkSynced = async () => {
    if (!previewData) return;
    const voucherUuids = previewData.vouchers.map((v) => v.uuid);
    const paymentUuids = previewData.payments.map((p) => p.uuid);

    if (voucherUuids.length === 0 && paymentUuids.length === 0) return;

    await markSyncedMutation.mutateAsync({
      voucher_uuids: voucherUuids,
      payment_uuids: paymentUuids,
    });
    refetch();
  };

  if (isLoading) return <LoadingState />;
  if (isError) return <EmptyState message="Failed to load export preview data." />;
  // Safeguard against undefined previewData for type checker
  if (!previewData) return <LoadingState />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Tally Sync"
          description="Prepare, preview, and generate XML data packages for Tally ERP 9 / TallyPrime import."
        />
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors shadow-sm self-start sm:self-center"
        >
          <Settings size={16} />
          Configure Ledgers
        </button>
      </div>

      {/* Date Filters & Controls */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar
                size={16}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                onClick={() => {
                  const el = document.getElementById("tallyFromDate") as HTMLInputElement | null;
                  if (el && typeof el.showPicker === "function") {
                    el.showPicker();
                  }
                }}
              />
              <input
                id="tallyFromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <span className="text-muted-foreground text-sm">to</span>
            <div className="flex items-center gap-2">
              <Calendar
                size={16}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                onClick={() => {
                  const el = document.getElementById("tallyToDate") as HTMLInputElement | null;
                  if (el && typeof el.showPicker === "function") {
                    el.showPicker();
                  }
                }}
              />
              <input
                id="tallyToDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium select-none cursor-pointer">
              <input
                type="checkbox"
                checked={markAsSynced}
                onChange={(e) => setMarkAsSynced(e.target.checked)}
                className="rounded border-border text-primary focus:ring-ring"
              />
              Auto-mark as synced on export
            </label>
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending || (previewData.total_vouchers === 0 && previewData.total_payments === 0)}
              className="flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm"
            >
              <Download size={16} />
              {exportMutation.isPending ? "Generating..." : "Download XML Package"}
            </button>
            <button
              onClick={handleMarkSynced}
              disabled={markSyncedMutation.isPending || (previewData.total_vouchers === 0 && previewData.total_payments === 0)}
              className="flex items-center gap-2 rounded-md border border-border bg-card hover:bg-muted/50 disabled:opacity-50 px-4 py-2 text-sm font-medium transition-colors shadow-sm"
            >
              <CheckCircle size={16} className="text-green-500" />
              Mark as Synced
            </button>
          </div>
        </div>
      </div>

      {/* Warnings block */}
      {previewData.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4">
          <div className="flex gap-2">
            <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-yellow-800">
                Integration Warnings ({previewData.warnings.length})
              </h4>
              <ul className="text-xs text-yellow-700 list-disc pl-4 space-y-1">
                {previewData.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-md bg-blue-50 text-blue-600 p-3">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Pending Vouchers</p>
            <h3 className="text-lg font-bold">{previewData.total_vouchers}</h3>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-md bg-green-50 text-green-600 p-3">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Pending Payments</p>
            <h3 className="text-lg font-bold">{previewData.total_payments}</h3>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-md bg-purple-50 text-purple-600 p-3">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Sales Value</p>
            <h3 className="text-lg font-bold">₹{Number(previewData.total_sales_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="rounded-md bg-orange-50 text-orange-600 p-3">
            <Layers size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Receipts Value</p>
            <h3 className="text-lg font-bold">₹{Number(previewData.total_receipts_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      {/* Tabs list table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-border bg-muted/40">
          <button
            onClick={() => setActiveTab("vouchers")}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${
              activeTab === "vouchers"
                ? "border-primary text-primary bg-card"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText size={16} />
            Vouchers ({previewData.vouchers.length})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-medium transition-all ${
              activeTab === "payments"
                ? "border-primary text-primary bg-card"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Wallet size={16} />
            Payments ({previewData.payments.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-x-auto">
          {activeTab === "vouchers" ? (
            previewData.vouchers.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No verified vouchers pending export in this date range.
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase">
                    <th className="p-4">Date</th>
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Fuel Type</th>
                    <th className="p-4 text-right">Liters</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4">Mode</th>
                    <th className="p-4">Tally Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.vouchers.map((v) => {
                    const isCredit = v.payment_mode === "CREDIT";
                    const hasLinkedCustomer = !!v.customer_uuid;
                    const tallyLedger = isCredit
                      ? (hasLinkedCustomer ? v.customer_name : `${v.customer_name || "Credit Customer"} (Unlinked)`)
                      : (v.payment_mode === "CASH" ? mappings.cash_ledger : v.payment_mode === "UPI" ? mappings.upi_ledger : mappings.card_ledger);
                    
                    return (
                      <tr key={v.uuid} className="hover:bg-muted/10">
                        <td className="p-4 font-medium whitespace-nowrap">{v.invoice_date}</td>
                        <td className="p-4 font-mono text-xs">{v.invoice_number}</td>
                        <td className="p-4 font-medium">
                          {isCredit && !hasLinkedCustomer ? (
                            <span className="flex items-center gap-1 text-yellow-600" title="Credit sale not linked to a customer record">
                              <AlertTriangle size={14} />
                              {v.customer_name || "Walk-In"}
                            </span>
                          ) : (
                            v.customer_name || "Walk-In"
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {v.fuel_type}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono">{v.quantity_liters.toFixed(2)} L</td>
                        <td className="p-4 text-right font-semibold font-mono">₹{v.total_amount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            v.payment_mode === "CREDIT"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {v.payment_mode}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-muted-foreground">{tallyLedger}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            previewData.payments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No customer payments pending export in this date range.
              </div>
            ) : (
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase">
                    <th className="p-4">Date</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Mode</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4">Reference #</th>
                    <th className="p-4">Debit Ledger</th>
                    <th className="p-4">Credit Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.payments.map((p) => {
                    const debitLedger = p.payment_mode === "CASH" ? mappings.cash_ledger : p.payment_mode === "UPI" ? mappings.upi_ledger : mappings.card_ledger;
                    return (
                      <tr key={p.uuid} className="hover:bg-muted/10">
                        <td className="p-4 font-medium whitespace-nowrap">{p.payment_date}</td>
                        <td className="p-4 font-medium">{p.customer_name}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            {p.payment_mode}
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold font-mono">₹{p.amount.toFixed(2)}</td>
                        <td className="p-4 font-mono text-xs text-muted-foreground">{p.reference_number || "—"}</td>
                        <td className="p-4 font-medium text-muted-foreground">{debitLedger}</td>
                        <td className="p-4 font-medium text-muted-foreground">{p.customer_name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      <TallySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={() => setTriggerRefresh((prev) => prev + 1)}
      />
    </div>
  );
}
