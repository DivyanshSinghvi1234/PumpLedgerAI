import { useState } from "react";

import { formatCurrency } from "@/lib/utils";

import SearchInput from "@/components/common/SearchInput";

import { useCustomerReport } from "../hooks/useCustomerReport";
import reportService from "../services/reportService";

export default function CustomerReportSection() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useCustomerReport(search);

  function exportCsv() {
    reportService.downloadCsv(
      "/v1/reports/customers/export",
      { search: search || undefined },
      "customer_report.csv"
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search customer name..."
        />

        <button
          onClick={exportCsv}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Export CSV
        </button>
      </div>

      {data && (
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>
            Customers: <strong>{data.count}</strong>
          </span>
          <span>
            Total Outstanding:{" "}
            <strong>
              {formatCurrency(data.total_outstanding)}
            </strong>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Mobile</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">GST</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit Limit</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No customers found.
                </td>
              </tr>
            ) : (
              data?.rows.map((r) => (
                <tr key={r.name + (r.customer_code ?? "")} className="border-t border-border">
                  <td className="px-3 py-2">{r.customer_code ?? "-"}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.mobile ?? "-"}</td>
                  <td className="px-3 py-2">{r.gst_number ?? "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(r.credit_limit)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(r.outstanding_balance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
