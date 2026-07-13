import { useState } from "react";

import { formatCurrency } from "@/lib/utils";

import FormInput from "@/components/forms/FormInput";

import { useDailySales } from "../hooks/useDailySales";
import reportService from "../services/reportService";

export default function DailySalesSection() {
  const [onDate, setOnDate] = useState("");

  const params = { on_date: onDate || undefined };

  const { data, isLoading } = useDailySales(params);

  function exportCsv() {
    reportService.downloadCsv(
      "/v1/reports/daily-sales/export",
      params,
      "daily_sales.csv"
    );
  }

  const metrics = data
    ? [
        { label: "Total Sales", value: formatCurrency(data.total_sales) },
        { label: "Total Vouchers", value: data.total_vouchers },
        { label: "Petrol Sales", value: formatCurrency(data.petrol_sales) },
        { label: "Diesel Sales", value: formatCurrency(data.diesel_sales) },
        { label: "Cash Sales", value: formatCurrency(data.cash_sales) },
        { label: "UPI Sales", value: formatCurrency(data.upi_sales) },
        { label: "Credit Sales", value: formatCurrency(data.credit_sales) },
        {
          label: "Average Invoice",
          value: formatCurrency(data.average_invoice),
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <FormInput
          type="date"
          label="Date (default today)"
          value={onDate}
          onChange={(e) => setOnDate(e.target.value)}
        />

        <button
          onClick={exportCsv}
          className="ml-auto rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-border bg-card p-4"
            >
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-lg font-semibold">{m.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
