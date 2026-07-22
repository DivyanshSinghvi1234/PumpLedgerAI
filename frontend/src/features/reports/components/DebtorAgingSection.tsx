import { formatCurrency } from "@/lib/utils";

import { useDebtorAging } from "../hooks/useDebtorAging";
import reportService from "../services/reportService";

export default function DebtorAgingSection() {
  const { data, isLoading, isError } = useDebtorAging();

  function exportCsv() {
    reportService.downloadCsv(
      "/v1/reports/debtor-aging/export",
      {},
      "debtor_aging.csv"
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Outstanding credit balances by invoice age. Oldest dues need chasing first.
        </p>

        <button
          onClick={exportCsv}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Export CSV
        </button>
      </div>

      {data && (
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span>
            Debtors: <strong>{data.count}</strong>
          </span>
          <span>
            Total Outstanding:{" "}
            <strong>{formatCurrency(data.total_outstanding)}</strong>
          </span>
          <span>
            60+ days:{" "}
            <strong className="text-red-600">
              {formatCurrency(data.total_60_plus)}
            </strong>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Mobile</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">0-15 d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">16-30 d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">31-60 d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">60+ d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-red-600">
                  Failed to load the debtor-aging report.
                </td>
              </tr>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No outstanding debtors.
                </td>
              </tr>
            ) : (
              data?.rows.map((r) => (
                <tr key={r.customer_uuid} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                  <td className="px-3 py-2">{r.mobile ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.bucket_0_15)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.bucket_16_30)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.bucket_31_60)}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-600">
                    {formatCurrency(r.bucket_60_plus)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(r.total_outstanding)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="bg-muted/50">
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totals</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_0_15)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_16_30)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_31_60)}</td>
                <td className="px-3 py-2 text-right text-red-600">{formatCurrency(data.total_60_plus)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_outstanding)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
