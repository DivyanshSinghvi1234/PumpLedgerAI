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
  Upload,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Code,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTallyPreview, useExportTally, useMarkTallySynced, getStoredTallyMappings, getStoredTallyVoucherTypes } from "./hooks/useTally";
import TallySettingsDialog from "./components/TallySettingsDialog";
import tallyService from "./services/tallyService";
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
  const [exportInventory, setExportInventory] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"vouchers" | "payments">("vouchers");
  const [isSyncingDirectly, setIsSyncingDirectly] = useState(false);
  const [viewMode, setViewMode] = useState<"export" | "import">("export");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // XML Inspector State
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectXmlContent, setInspectXmlContent] = useState("");
  const [isGeneratingXml, setIsGeneratingXml] = useState(false);

  const [triggerRefresh, setTriggerRefresh] = useState(0);

  const mappings = useMemo(() => getStoredTallyMappings(), [triggerRefresh]);
  const voucherTypes = useMemo(() => getStoredTallyVoucherTypes(), [triggerRefresh]);

  const request: TallyExportRequest = useMemo(() => ({
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    mark_as_synced: false, // handled explicitly in export call
    export_inventory: exportInventory,
    ledger_mappings: mappings,
    voucher_types: voucherTypes,
  }), [fromDate, toDate, exportInventory, mappings, voucherTypes]);

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
      if (blob.type === "application/json") {
        const text = await blob.text();
        try {
          const json = JSON.parse(text);
          alert(`Export failed: ${json.detail || "Server error"}`);
        } catch (_) {
          alert(`Export failed: ${text}`);
        }
        return;
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `tally_import_${getFilenameDateString()}.xml`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      refetch();
    } catch (err: any) {
      console.error(err);
      let message = "Failed to download Tally XML package.";
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          message = json.detail || message;
        } catch (_) {}
      } else if (err?.message) {
        message = err.message;
      }
      alert(`Export error: ${message}`);
    }
  };

  const handleInspectXml = async () => {
    if (!previewData) return;
    setIsGeneratingXml(true);
    try {
      const exportReq: TallyExportRequest = {
        ...request,
        mark_as_synced: false,
      };
      const blob = await exportMutation.mutateAsync(exportReq);
      const text = await blob.text();
      setInspectXmlContent(text);
      setInspectorOpen(true);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate XML preview.");
    } finally {
      setIsGeneratingXml(false);
    }
  };

  const handleCopyXml = () => {
    if (!inspectXmlContent) return;
    navigator.clipboard.writeText(inspectXmlContent);
    toast.success("XML content copied to clipboard!");
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

  const handleDirectSync = async () => {
    if (!previewData) return;
    setIsSyncingDirectly(true);

    const exportReq: TallyExportRequest = {
      ...request,
      mark_as_synced: false,
    };

    try {
      const blob = await exportMutation.mutateAsync(exportReq);
      const xmlText = await blob.text();

      await fetch("http://localhost:9000", {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
        },
        body: xmlText,
        mode: "no-cors",
      });

      toast.success("Sync command sent directly to local Tally on port 9000!");

      if (markAsSynced) {
        await handleMarkSynced();
      }
      refetch();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to connect to local Tally. Make sure Tally is open and Server Port 9000 is enabled.");
    } finally {
      setIsSyncingDirectly(false);
    }
  };

  const handleImportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("Please select an XML file to upload.");
      return;
    }

    setIsUploading(true);
    setImportError(null);
    setImportResult(null);

    try {
      const res = await tallyService.importTallyXml(importFile);
      setImportResult(res);
      toast.success("Tally data package parsed and imported successfully!");
    } catch (err: any) {
      console.error(err);
      let errMsg = "Import failed. Please verify that the XML file follows standard Tally export structure.";
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === "string") {
          errMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errMsg = err.response.data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
        } else {
          errMsg = JSON.stringify(err.response.data.detail);
        }
      }
      setImportError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
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

      {/* Mode Navigation tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setViewMode("export")}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            viewMode === "export"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Export to Tally
        </button>
        <button
          onClick={() => setViewMode("import")}
          className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            viewMode === "import"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Import / Data Migration
        </button>
      </div>

      {viewMode === "export" ? (
        <>
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

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium select-none cursor-pointer">
              <input
                type="checkbox"
                checked={markAsSynced}
                onChange={(e) => setMarkAsSynced(e.target.checked)}
                className="rounded border-border text-primary focus:ring-ring"
              />
              Auto-mark as synced
            </label>
            <label className="flex items-center gap-2 text-sm font-medium select-none cursor-pointer">
              <input
                type="checkbox"
                checked={exportInventory}
                onChange={(e) => setExportInventory(e.target.checked)}
                className="rounded border-border text-primary focus:ring-ring"
              />
              Sync inventory stock
            </label>
            <button
              onClick={handleDirectSync}
              disabled={isSyncingDirectly || exportMutation.isPending || (previewData.total_vouchers === 0 && previewData.total_payments === 0)}
              className="flex items-center gap-2 rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <CheckCircle size={16} />
              {isSyncingDirectly ? "Syncing..." : "Sync to Local Tally (Port 9000)"}
            </button>
            <button
              onClick={handleInspectXml}
              disabled={isGeneratingXml || exportMutation.isPending || (previewData.total_vouchers === 0 && previewData.total_payments === 0)}
              className="flex items-center gap-2 rounded-md border border-fuel-amber/30 bg-fuel-amber/10 text-fuel-amber hover:bg-fuel-amber/20 disabled:opacity-50 px-4 py-2 text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Code size={16} />
              {isGeneratingXml ? "Generating XML..." : "Inspect Tally XML"}
            </button>
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending || (previewData.total_vouchers === 0 && previewData.total_payments === 0)}
              className="flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Download size={16} />
              {exportMutation.isPending ? "Generating..." : "Download XML Package"}
            </button>
            <button
              onClick={handleMarkSynced}
              disabled={markSyncedMutation.isPending || (previewData.total_vouchers === 0 && previewData.total_payments === 0)}
              className="flex items-center gap-2 rounded-md border border-border bg-card hover:bg-muted/50 disabled:opacity-50 px-4 py-2 text-sm font-medium transition-colors shadow-sm cursor-pointer"
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
                        <td className="p-4 text-right font-mono">{Number(v.quantity_liters).toFixed(2)} L</td>
                        <td className="p-4 text-right font-semibold font-mono">₹{Number(v.total_amount).toFixed(2)}</td>
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
                        <td className="p-4 text-right font-semibold font-mono">₹{Number(p.amount).toFixed(2)}</td>
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
      </>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-foreground">Import Tally Data Package</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              Upload XML files exported from Tally ERP 9 or TallyPrime to import historical customer accounts, opening outstanding balances, sales vouchers, and receipts.
            </p>
            
            <div className="rounded-lg bg-muted/20 p-4 border border-border/60 text-xs text-muted-foreground space-y-1.5">
              <span className="font-semibold text-foreground">How to export:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Ledgers (Masters) &amp; Balances:</strong> Go to <em>Gateway of Tally &gt; List of Accounts</em>, press <strong>Alt+E</strong>, choose XML format, and set <em>Include Opening Balances</em> to <strong>Yes</strong>.</li>
                <li><strong>Invoices &amp; Receipts:</strong> Go to <em>Gateway of Tally &gt; Day Book</em>, press <strong>Alt+F2</strong> to select date range, press <strong>Alt+E</strong>, choose XML format, and set <em>Detailed</em> to <strong>Yes</strong>.</li>
              </ul>
            </div>

            <form onSubmit={handleImportUpload} className="space-y-4 pt-2">
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors bg-card relative"
                onClick={() => document.getElementById("tally-import-input")?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    setImportFile(e.dataTransfer.files[0]);
                    setImportResult(null);
                    setImportError(null);
                  }
                }}
              >
                <input
                  id="tally-import-input"
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                      setImportResult(null);
                      setImportError(null);
                    }
                  }}
                />
                
                <Upload className="mx-auto text-muted-foreground mb-2" size={28} />
                {importFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImportFile(null);
                        setImportResult(null);
                        setImportError(null);
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-semibold inline-flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      <X size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">Drag &amp; drop Tally XML file here, or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">Accepts .xml formats exported from Tally</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                {importFile && (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 text-sm font-semibold shadow-sm cursor-pointer animate-fade-in"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Uploading &amp; Parsing XML...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Start Migration Import
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Import Results Summary Dashboard */}
          {importResult && (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <CheckCircle2 className="text-green-500" size={20} />
                  <h3 className="text-sm font-bold text-foreground">Import Summary Report</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto bg-muted px-2 py-0.5 rounded-full font-mono">
                    Duration: {(importResult.duration_ms / 1000).toFixed(2)}s
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="rounded-lg border border-border bg-muted/10 p-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Cust. Imported</p>
                    <p className="text-lg font-bold text-green-600 mt-1">{importResult.customers_imported}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Cust. Skipped</p>
                    <p className="text-lg font-bold text-muted-foreground mt-1">{importResult.customers_skipped}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Sales Imported</p>
                    <p className="text-lg font-bold text-blue-600 mt-1">{importResult.vouchers_imported}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Receipts Imported</p>
                    <p className="text-lg font-bold text-purple-600 mt-1">{importResult.payments_imported}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Duplicates</p>
                    <p className="text-lg font-bold text-orange-500 mt-1">{importResult.duplicates_found}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-3 text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">Errors</p>
                    <p className="text-lg font-bold text-red-500 mt-1">{importResult.parse_errors}</p>
                  </div>
                </div>
              </div>

              {/* Rich Warnings Table / Log */}
              {importResult.warnings && importResult.warnings.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-orange-500" size={18} />
                    <h3 className="text-sm font-bold text-foreground">Import Log Warnings ({importResult.warnings.length})</h3>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase">
                          <th className="p-3">Type</th>
                          <th className="p-3">Voucher #</th>
                          <th className="p-3">Description / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {importResult.warnings.map((w: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/5">
                            <td className="p-3 font-semibold whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                w.type.toLowerCase().includes("duplicate")
                                  ? "bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400"
                                  : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
                              }`}>
                                {w.type}
                              </span>
                            </td>
                            <td className="p-3 font-mono">{w.voucher_number || "—"}</td>
                            <td className="p-3 text-muted-foreground font-medium">{w.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {importError && (
            <div className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/10 p-4 text-xs text-red-700 dark:text-red-400 flex gap-2">
              <XCircle className="shrink-0 mt-0.5" size={16} />
              <div>
                <h4 className="font-bold">Migration Interrupted</h4>
                <p className="mt-1">{importError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <TallySettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSave={() => setTriggerRefresh((prev) => prev + 1)}
      />

      {/* Tally XML Inspector Modal */}
      <Dialog open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <DialogContent className="max-w-4xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Code className="text-fuel-amber" size={20} />
              Tally ERP 9 / TallyPrime XML Package Inspector
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Previewing raw XML tags generated for Tally import:</span>
              <span className="font-mono text-ink">{inspectXmlContent.length} bytes</span>
            </div>

            <pre className="max-h-[60vh] overflow-auto p-4 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed border border-slate-800 selection:bg-emerald-900 selection:text-white">
              {inspectXmlContent || "<!-- No XML content generated -->"}
            </pre>
          </div>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 justify-between">
            <button
              type="button"
              onClick={handleCopyXml}
              className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 hover:bg-surface-3 px-4 py-2 text-sm font-medium text-ink transition cursor-pointer"
            >
              <Copy size={16} />
              Copy to Clipboard
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInspectorOpen(false)}
                className="rounded-md border border-hairline px-4 py-2 text-sm font-medium text-ink-muted hover:bg-surface-2 transition cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  handleExport();
                  setInspectorOpen(false);
                }}
                className="flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium transition cursor-pointer"
              >
                <Download size={16} />
                Download XML Package
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
