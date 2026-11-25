import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PrinterIcon, FileTextIcon } from "lucide-react";

import api from "@/api/client";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { formatCurrency } from "@/lib/utils";
import settingService from "@/features/settings/services/settingService";
import type { StationBranding } from "@/features/settings/components/StationBrandingDialog";

interface LedgerRow {
  entry_type: string;
  amount: number;
  signed_amount: number;
  balance_after: number;
  entry_date: string;
  reference_type: string | null;
  remarks: string | null;
}

interface GSTInvoiceResponse {
  customer_uuid: string;
  customer_name: string;
  customer_code?: string | null;
  gst_number?: string | null;
  address?: string | null;
  mobile?: string | null;
  billing_month: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  hsn_summary: {
    fuel_type: string;
    hsn_code: string;
    total_liters: number;
    taxable_amount: number;
  }[];
  vehicle_subtotals: {
    vehicle_number: string;
    slip_count: number;
    total_liters: number;
    total_amount: number;
  }[];
  line_items: {
    invoice_date: string;
    invoice_number: string;
    vehicle_number: string;
    fuel_type: string;
    hsn_code: string;
    quantity_liters: number;
    rate_per_liter: number;
    total_amount: number;
  }[];
  total_liters: number;
  grand_total: number;
  slip_count: number;
}

export default function CustomerStatementPrint() {
  const { customerUuid = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [docMode, setDocMode] = useState<"statement" | "gst">(
    searchParams.get("mode") === "gst" ? "gst" : "statement"
  );
  const [billingMonth, setBillingMonth] = useState(() => {
    const paramMonth = searchParams.get("month");
    if (paramMonth) return paramMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Fetch customer details
  const { data: customer, isLoading: isLoadingCustomer } = useQuery({
    queryKey: ["customer-detail", customerUuid],
    queryFn: async () => {
      const res = await api.get(`/v1/customers/${customerUuid}`);
      return res.data;
    },
    enabled: Boolean(customerUuid),
  });

  // Fetch statement report (all entries)
  const { data: statement, isLoading: isLoadingStatement, isError } = useQuery({
    queryKey: ["report-statement-print", customerUuid],
    queryFn: async () => {
      const res = await api.get(`/v1/reports/ledger/${customerUuid}`);
      return res.data;
    },
    enabled: Boolean(customerUuid),
  });

  // Fetch station branding
  const { data: branding } = useQuery({
    queryKey: ["settings", "station_branding"],
    queryFn: () => settingService.getSetting<StationBranding>("station_branding"),
  });

  const { data: gstInvoice, isLoading: isLoadingGst } = useQuery<GSTInvoiceResponse>({
    queryKey: ["report-gst-invoice", customerUuid, billingMonth],
    queryFn: async () => {
      const res = await api.get(`/v1/reports/gst-invoice/${customerUuid}`, {
        params: { month: billingMonth },
      });
      return res.data;
    },
    enabled: Boolean(customerUuid) && docMode === "gst",
  });

  // Auto-print only after both data sources are resolved and rendering is complete
  useEffect(() => {
    if (!isLoadingCustomer && !isLoadingStatement && customer && statement) {
      const timer = setTimeout(() => {
        window.print();
      }, 800); // 800ms buffer to ensure DOM layout is fully painted
      return () => clearTimeout(timer);
    }
  }, [isLoadingCustomer, isLoadingStatement, customer, statement]);

  if (isLoadingCustomer || isLoadingStatement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background print:hidden">
        <LoadingState />
      </div>
    );
  }

  if (isError || !customer || !statement) {
    return (
      <div className="p-8 print:hidden">
        <EmptyState message="Unable to load customer statement." />
      </div>
    );
  }

  // Calculate totals
  const totalDebit = statement.rows.reduce(
    (sum: number, r: LedgerRow) => (r.signed_amount > 0 ? sum + r.amount : sum),
    0
  );
  const totalCredit = statement.rows.reduce(
    (sum: number, r: LedgerRow) => (r.signed_amount < 0 ? sum + r.amount : sum),
    0
  );

  return (
    <div className="min-h-screen bg-canvas p-4 md:p-8 print:bg-white print:p-0">
      {/* Action Header — Hidden during print */}
      <div className="mx-auto max-w-4xl mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-muted/30 transition cursor-pointer"
        >
          <ArrowLeftIcon size={16} />
          <span>Back to Ledger</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDocMode(docMode === "statement" ? "gst" : "statement")}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-muted/30 transition cursor-pointer"
          >
            <FileTextIcon size={16} />
            <span>{docMode === "gst" ? "Switch to Statement" : "Monthly GST Tax Invoice"}</span>
          </button>

          {docMode === "gst" && (
            <input
              type="month"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink"
            />
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
          >
            <PrinterIcon size={16} />
            <span>{docMode === "gst" ? "Print GST Invoice" : "Print Statement"}</span>
          </button>
        </div>
      </div>

      {/* Printable Statement Container */}
      <div className="mx-auto max-w-4xl border border-hairline rounded-2xl bg-card p-8 shadow-sm print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        {/* Corporate Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-b pb-6 mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink print:text-black">
              {branding?.station_name || "PUMPLEDGER AI"}
            </h1>
            {branding?.tagline && (
              <p className="text-xs text-ink-muted print:text-gray-600 mt-1 font-medium">
                {branding.tagline}
              </p>
            )}
            {branding?.gstin && (
              <p className="text-xs text-ink-muted print:text-gray-600">
                GSTIN: {branding.gstin}
              </p>
            )}
            {branding?.phone && (
              <p className="text-xs text-ink-muted print:text-gray-600">
                Tel: {branding.phone}
              </p>
            )}
            {branding?.address && (
              <p className="text-xs text-ink-muted print:text-gray-600">
                {branding.address}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <h2 className="text-lg font-bold uppercase tracking-wide text-ink print:text-black">
              {docMode === "gst" ? "Consolidated Monthly Tax Invoice" : "Account Statement"}
            </h2>
            {docMode === "gst" && gstInvoice && (
              <p className="text-xs font-mono font-semibold text-ink print:text-black mt-1">
                Invoice No: {gstInvoice.invoice_number}
              </p>
            )}
            <p className="text-xs text-ink-muted print:text-gray-600 mt-1">
              Generated Date: {new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {docMode === "gst" && gstInvoice ? (
              <p className="text-xs text-ink-muted print:text-gray-600">
                Billing Period: {gstInvoice.period_start} to {gstInvoice.period_end}
              </p>
            ) : statement.from_date ? (
              <p className="text-xs text-ink-muted print:text-gray-600">
                Period: {statement.from_date} to {statement.to_date || "Present"}
              </p>
            ) : null}
          </div>
        </div>

        {/* Client details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border border-hairline mb-8 print:bg-gray-50 print:border-gray-200">
          <div>
            <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 print:text-gray-700">
              Customer Information
            </h3>
            <div className="text-sm font-semibold text-ink print:text-black">
              {customer.name}
            </div>
            {customer.customer_code && (
              <div className="text-xs text-ink-muted print:text-gray-600 mt-0.5">
                Client Code: {customer.customer_code}
              </div>
            )}
            {customer.mobile && (
              <div className="text-xs text-ink-muted print:text-gray-600 mt-0.5">
                Mobile: {customer.mobile}
              </div>
            )}
            {customer.gst_number && (
              <div className="text-xs text-ink-muted print:text-gray-600 mt-0.5">
                GSTIN: {customer.gst_number}
              </div>
            )}
          </div>
          <div className="flex flex-col justify-end sm:items-end">
            <div className="text-xs text-ink-muted print:text-gray-600">
              Opening Balance:
            </div>
            <div className="text-sm font-semibold font-mono text-ink print:text-black mb-2">
              {formatCurrency(statement.opening_balance)}
            </div>
            <div className="text-xs text-ink-muted print:text-gray-600">
              Closing Outstanding Balance:
            </div>
            <div className="text-base font-bold font-mono text-error print:text-black">
              {formatCurrency(statement.closing_balance)}
            </div>
          </div>
        </div>

        {docMode === "gst" ? (
          isLoadingGst ? (
            <div className="py-12 text-center text-sm text-ink-muted">Loading GST invoice…</div>
          ) : !gstInvoice ? (
            <div className="py-12 text-center text-sm text-ink-muted">No GST invoice data for {billingMonth}.</div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-4 text-center text-xs border border-hairline rounded-xl p-3 bg-muted/10 print:bg-transparent print:border-gray-300">
                <div>
                  <span className="text-ink-muted block uppercase tracking-wider mb-0.5">Total Slips</span>
                  <span className="font-semibold font-mono text-sm">{gstInvoice.slip_count}</span>
                </div>
                <div>
                  <span className="text-ink-muted block uppercase tracking-wider mb-0.5">Total Quantity</span>
                  <span className="font-semibold font-mono text-sm">{Number(gstInvoice.total_liters).toFixed(2)} L</span>
                </div>
                <div>
                  <span className="text-ink-muted block uppercase tracking-wider mb-0.5">Invoice Grand Total</span>
                  <span className="font-semibold font-mono text-sm text-ink">{formatCurrency(gstInvoice.grand_total)}</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">HSN / Fuel Grade Summary</h3>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-ink-muted/20">
                      <th className="py-2 px-2">Fuel Grade</th>
                      <th className="py-2 px-2">HSN Code</th>
                      <th className="py-2 px-2 text-right">Quantity (L)</th>
                      <th className="py-2 px-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstInvoice.hsn_summary.map((row) => (
                      <tr key={row.fuel_type} className="border-b border-hairline">
                        <td className="py-2 px-2 font-semibold">{row.fuel_type}</td>
                        <td className="py-2 px-2 font-mono">{row.hsn_code}</td>
                        <td className="py-2 px-2 text-right font-mono">{Number(row.total_liters).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono font-semibold">{formatCurrency(row.taxable_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">Vehicle-Wise Subtotals</h3>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-ink-muted/20">
                      <th className="py-2 px-2">Vehicle Number</th>
                      <th className="py-2 px-2 text-right">Slips</th>
                      <th className="py-2 px-2 text-right">Quantity (L)</th>
                      <th className="py-2 px-2 text-right">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstInvoice.vehicle_subtotals.map((v) => (
                      <tr key={v.vehicle_number} className="border-b border-hairline">
                        <td className="py-2 px-2 font-mono font-semibold">{v.vehicle_number}</td>
                        <td className="py-2 px-2 text-right font-mono">{v.slip_count}</td>
                        <td className="py-2 px-2 text-right font-mono">{Number(v.total_liters).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono font-semibold">{formatCurrency(v.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">Itemized Fuel Slips</h3>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-ink-muted/20">
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Slip No</th>
                      <th className="py-2 px-2">Vehicle</th>
                      <th className="py-2 px-2">Fuel (HSN)</th>
                      <th className="py-2 px-2 text-right">Qty (L)</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstInvoice.line_items.map((item, idx) => (
                      <tr key={`${item.invoice_number}-${idx}`} className="border-b border-hairline">
                        <td className="py-2 px-2">{item.invoice_date}</td>
                        <td className="py-2 px-2 font-mono">{item.invoice_number}</td>
                        <td className="py-2 px-2 font-mono">{item.vehicle_number}</td>
                        <td className="py-2 px-2">{item.fuel_type} ({item.hsn_code})</td>
                        <td className="py-2 px-2 text-right font-mono">{Number(item.quantity_liters).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono">{Number(item.rate_per_liter).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right font-mono font-semibold">{formatCurrency(item.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
        <>
        {/* Transaction Summary Blocks */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-center text-xs border border-hairline rounded-xl p-3 bg-muted/10 print:bg-transparent print:border-gray-300">
          <div>
            <span className="text-ink-muted block uppercase tracking-wider mb-0.5">Opening</span>
            <span className="font-semibold font-mono text-sm">{formatCurrency(statement.opening_balance)}</span>
          </div>
          <div>
            <span className="text-ink-muted block uppercase tracking-wider mb-0.5">Total Sales (+)</span>
            <span className="font-semibold font-mono text-sm text-ink">{formatCurrency(totalDebit)}</span>
          </div>
          <div>
            <span className="text-ink-muted block uppercase tracking-wider mb-0.5">Total Received (-)</span>
            <span className="font-semibold font-mono text-sm text-success">{formatCurrency(totalCredit)}</span>
          </div>
        </div>

        {/* Ledger Rows Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-ink-muted/20 print:border-gray-400">
                <th className="py-3 px-2">Date</th>
                <th className="py-3 px-2">Particulars</th>
                <th className="py-3 px-2">Reference</th>
                <th className="py-3 px-2 text-right">Debit (₹)</th>
                <th className="py-3 px-2 text-right">Credit (₹)</th>
                <th className="py-3 px-2 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {statement.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-muted">
                    No transactions recorded during this period.
                  </td>
                </tr>
              ) : (
                statement.rows.map((row: LedgerRow, idx: number) => {
                  const isDebit = row.signed_amount > 0;
                  const isCredit = row.signed_amount < 0;
                  return (
                    <tr
                      key={idx}
                      className="border-b border-hairline hover:bg-muted/5 transition-colors print:border-gray-200"
                    >
                      <td className="py-2.5 px-2 font-medium text-ink-muted print:text-black">
                        {new Date(row.entry_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-ink print:text-black">
                          {row.entry_type === "VOUCHER"
                            ? "Credit Invoice"
                            : row.entry_type === "PAYMENT"
                            ? "Payment Received"
                            : row.entry_type === "DEBIT_ADJUSTMENT"
                            ? "Debit Adjustment"
                            : row.entry_type === "CREDIT_ADJUSTMENT"
                            ? "Credit Adjustment"
                            : row.entry_type}
                        </div>
                        {row.remarks && (
                          <div className="text-[10px] text-ink-tertiary print:text-gray-500 mt-0.5 max-w-xs">
                            {row.remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px] text-ink-muted print:text-gray-700">
                        {row.reference_type === "VOUCHER" && "INV-"}
                        {row.remarks && row.remarks.includes("invoice")
                          ? row.remarks.split("invoice")[1]?.trim()
                          : row.remarks && row.remarks.includes("INV-")
                          ? row.remarks.split("INV-")[1]?.split(" ")[0]
                          : row.remarks && row.remarks.includes("INV")
                          ? row.remarks.split("INV")[1]?.split(" ")[0]
                          : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-ink print:text-black">
                        {isDebit ? formatCurrency(row.amount) : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-success print:text-black">
                        {isCredit ? formatCurrency(row.amount) : "—"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-ink print:text-black">
                        {formatCurrency(row.balance_after)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </>
        )}

        {/* Corporate Sign-off Footer */}
        <div className="mt-16 flex justify-between items-end border-t pt-8 text-[10px] text-ink-muted print:text-gray-600">
          <div>
            <p>1. This is a computer-generated account statement and requires no physical signature.</p>
            <p>2. Please check statement entries. Report discrepancies, if any, within 7 days of generation.</p>
          </div>
          <div className="text-right flex flex-col items-center">
            <div className="h-10 w-32 border-b border-dashed border-gray-400 mb-2"></div>
            <p className="font-semibold text-ink print:text-black">Authorised Signatory</p>
            <p className="text-[9px]">PumpLedger AI</p>
          </div>
        </div>
      </div>
    </div>
  );
}
