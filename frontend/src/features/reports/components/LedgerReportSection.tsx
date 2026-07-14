import { useMemo, useState } from "react";

import { formatCurrency, getTodayDateString } from "@/lib/utils";

import FormSelect from "@/components/forms/FormSelect";
import FormDatePicker from "@/components/forms/FormDatePicker";

import { useCustomerOptions } from "@/features/payments/hooks/useCustomerOptions";

import { useLedgerReport } from "../hooks/useLedgerReport";
import reportService from "../services/reportService";

const TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  VOUCHER: "Voucher",
  PAYMENT: "Payment",
  DEBIT_ADJUSTMENT: "Debit Adjustment",
  CREDIT_ADJUSTMENT: "Credit Adjustment",
};

export default function LedgerReportSection() {
  const [customerUuid, setCustomerUuid] = useState("");
  const [fromDate, setFromDate] = useState(getTodayDateString());
  const [toDate, setToDate] = useState(getTodayDateString());

  const { data: customerData } = useCustomerOptions();

  const customerOptions = useMemo(
    () => [
      { label: "Select customer...", value: "" },
      ...(customerData?.items ?? []).map((c) => ({
        label: c.name,
        value: c.uuid,
      })),
    ],
    [customerData]
  );

  const params = {
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  };

  const { data, isLoading } = useLedgerReport(
    customerUuid,
    params
  );

  function exportCsv() {
    if (!customerUuid) return;
    reportService.downloadCsv(
      `/v1/reports/ledger/${customerUuid}/export`,
      params,
      "ledger_report.csv"
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <FormSelect
            label="Customer"
            options={customerOptions}
            value={customerUuid}
            onChange={(e) => setCustomerUuid(e.target.value)}
          />
        </div>
        <FormDatePicker
          label="From"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <FormDatePicker
          label="To"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />

        <button
          onClick={exportCsv}
          disabled={!customerUuid}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      {!customerUuid ? (
        <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
          Select a customer to view their statement.
        </div>
      ) : (
        <>
          {data && (
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>
                Opening:{" "}
                <strong>
                  {formatCurrency(data.opening_balance)}
                </strong>
              </span>
              <span>
                Closing:{" "}
                <strong>
                  {formatCurrency(data.closing_balance)}
                </strong>
              </span>
              <span>
                Entries: <strong>{data.count}</strong>
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Remarks</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Debit</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Credit</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</th>
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
                      No entries in this range.
                    </td>
                  </tr>
                ) : (
                  data?.rows.map((r, i) => {
                    const isDebit = r.signed_amount >= 0;
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{r.entry_date}</td>
                        <td className="px-3 py-2">
                          {TYPE_LABELS[r.entry_type] ?? r.entry_type}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.remarks ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {isDebit ? formatCurrency(r.amount) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!isDebit ? formatCurrency(r.amount) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatCurrency(r.balance_after)}
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
    </div>
  );
}
