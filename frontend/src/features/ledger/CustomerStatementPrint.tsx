import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";

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

export default function CustomerStatementPrint() {
  const { customerUuid = "" } = useParams();
  const navigate = useNavigate();

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

  // Fetch station branding
  const { data: branding } = useQuery({
    queryKey: ["settings", "station_branding"],
    queryFn: () => settingService.getSetting<StationBranding>("station_branding"),
  });

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
      <div className="mx-auto max-w-4xl mb-6 flex items-center justify-between border-b pb-4 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-muted/30 transition cursor-pointer"
        >
          <ArrowLeftIcon size={16} />
          <span>Back to Ledger</span>
        </button>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
        >
          <PrinterIcon size={16} />
          <span>Print Statement</span>
        </button>
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
              Account Statement
            </h2>
            <p className="text-xs text-ink-muted print:text-gray-600 mt-1">
              Generated Date: {new Date().toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {statement.from_date && (
              <p className="text-xs text-ink-muted print:text-gray-600">
                Period: {statement.from_date} to {statement.to_date || "Present"}
              </p>
            )}
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
