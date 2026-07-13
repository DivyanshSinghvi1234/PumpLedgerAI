import { useState } from "react";

import { formatCurrency } from "@/lib/utils";

import FormSelect from "@/components/forms/FormSelect";
import FormInput from "@/components/forms/FormInput";

import VoucherStatusBadge from "@/features/vouchers/components/VoucherStatusBadge";

import { useVoucherReport } from "../hooks/useVoucherReport";
import reportService from "../services/reportService";

const FUEL_OPTIONS = [
  { label: "All Fuels", value: "" },
  { label: "Petrol", value: "PETROL" },
  { label: "Diesel", value: "DIESEL" },
  { label: "Lubricant", value: "LUBRICANT" },
];

const PAYMENT_OPTIONS = [
  { label: "All Modes", value: "" },
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Credit", value: "CREDIT" },
];

export default function VoucherReportSection() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  const params = {
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
    fuel_type: fuelType || undefined,
    payment_mode: paymentMode || undefined,
  };

  const { data, isLoading } = useVoucherReport(params);

  function exportCsv() {
    reportService.downloadCsv(
      "/v1/reports/vouchers/export",
      params,
      "voucher_report.csv"
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <FormInput
          type="date"
          label="From"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <FormInput
          type="date"
          label="To"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <FormSelect
          label="Fuel"
          options={FUEL_OPTIONS}
          value={fuelType}
          onChange={(e) => setFuelType(e.target.value)}
        />
        <FormSelect
          label="Payment"
          options={PAYMENT_OPTIONS}
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value)}
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
            Vouchers: <strong>{data.count}</strong>
          </span>
          <span>
            Total Quantity:{" "}
            <strong>{data.total_quantity} L</strong>
          </span>
          <span>
            Total Amount:{" "}
            <strong>
              {formatCurrency(data.total_amount)}
            </strong>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Fuel</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Qty (L)</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Mode</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  No vouchers found.
                </td>
              </tr>
            ) : (
              data?.rows.map((r) => (
                <tr key={r.invoice_number} className="border-t border-border">
                  <td className="px-3 py-2">{r.invoice_number}</td>
                  <td className="px-3 py-2">{r.invoice_date}</td>
                  <td className="px-3 py-2">
                    {r.customer_name ?? "-"}
                  </td>
                  <td className="px-3 py-2">{r.fuel_type}</td>
                  <td className="px-3 py-2 text-right">
                    {r.quantity_liters}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(r.total_amount)}
                  </td>
                  <td className="px-3 py-2">{r.payment_mode}</td>
                  <td className="px-3 py-2">
                    <VoucherStatusBadge
                      status={r.verification_status}
                    />
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
