import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PhoneIcon,
  ArrowRightIcon,
  SearchIcon,
} from "lucide-react";

import api from "@/api/client";
import { formatCurrency } from "@/lib/utils";

interface InvoiceDetail {
  uuid: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  balance_due: number;
  age_days: number;
}

interface CustomerOutline {
  customer_uuid: string;
  customer_name: string;
  mobile: string | null;
  total_outstanding: number;
  bucket_0_15: number;
  bucket_15_30: number;
  bucket_30_60: number;
  bucket_60_plus: number;
  invoices: InvoiceDetail[];
}

type BucketKey = "0_15" | "15_30" | "30_60" | "60_plus";

const BUCKET_METADATA: Record<
  BucketKey,
  { label: string; rangeText: string; colorClass: string; bgClass: string; borderClass: string }
> = {
  "0_15": {
    label: "0-15 Days",
    rangeText: "0 to 15 days old",
    colorClass: "text-emerald-500 bg-emerald-500",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/20",
  },
  "15_30": {
    label: "15-30 Days",
    rangeText: "16 to 30 days old",
    colorClass: "text-amber-500 bg-amber-500",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/20",
  },
  "30_60": {
    label: "30-60 Days",
    rangeText: "31 to 60 days old",
    colorClass: "text-orange-500 bg-orange-500",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/20",
  },
  "60_plus": {
    label: "60+ Days",
    rangeText: "More than 60 days old",
    colorClass: "text-rose-500 bg-rose-500",
    bgClass: "bg-rose-500/10",
    borderClass: "border-rose-500/20",
  },
};

export default function DebtorAgingCard() {
  const [selectedBucket, setSelectedBucket] = useState<BucketKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: agingData, isLoading } = useQuery({
    queryKey: ["debtor-aging"],
    queryFn: async () => {
      const res = await api.get("/v1/analytics/debtor-aging");
      return res.data;
    },
  });

  if (isLoading || !agingData) {
    return (
      <div className="card-glow rounded-xl border border-hairline bg-surface-1 p-6 animate-pulse space-y-4">
        <div className="h-4 w-1/4 bg-muted rounded"></div>
        <div className="h-8 w-1/3 bg-muted rounded"></div>
        <div className="h-10 w-full bg-muted rounded-xl"></div>
      </div>
    );
  }

  const totals = agingData.totals;
  const customers: CustomerOutline[] = agingData.customers || [];
  const grandTotal = parseFloat(totals.total_outstanding) || 0;

  // Gather flat list of invoices for the selected bucket
  const getSelectedInvoices = () => {
    if (!selectedBucket) return [];

    const list: { customerName: string; mobile: string | null; customerUuid: string; invoice: InvoiceDetail }[] = [];

    customers.forEach((cust) => {
      cust.invoices.forEach((inv) => {
        let match = false;
        if (selectedBucket === "0_15" && inv.age_days <= 15) match = true;
        if (selectedBucket === "15_30" && inv.age_days > 15 && inv.age_days <= 30) match = true;
        if (selectedBucket === "30_60" && inv.age_days > 30 && inv.age_days <= 60) match = true;
        if (selectedBucket === "60_plus" && inv.age_days > 60) match = true;

        if (match) {
          list.push({
            customerName: cust.customer_name,
            mobile: cust.mobile || null,
            customerUuid: cust.customer_uuid,
            invoice: inv,
          });
        }
      });
    });

    // Sort by age descending (oldest late payments first)
    return list.sort((a, b) => b.invoice.age_days - a.invoice.age_days);
  };

  const selectedInvoices = getSelectedInvoices();

  // Filter invoices by search query
  const filteredInvoices = selectedInvoices.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.customerName.toLowerCase().includes(query) ||
      item.invoice.invoice_number.toLowerCase().includes(query)
    );
  });

  // Calculate percentages for stacked bar chart
  const getPercentage = (amountStr: string) => {
    const val = parseFloat(amountStr) || 0;
    if (grandTotal === 0) return 0;
    return (val / grandTotal) * 100;
  };

  const pct0_15 = getPercentage(totals.bucket_0_15);
  const pct15_30 = getPercentage(totals.bucket_15_30);
  const pct30_60 = getPercentage(totals.bucket_30_60);
  const pct60_plus = getPercentage(totals.bucket_60_plus);

  return (
    <div className="card-glow rounded-xl border border-hairline bg-surface-1 p-6 transition-all duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-ink">
            Receivables Aging Dashboard
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Credit invoices grouped by payment delay period.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
            Total Outstanding Debt
          </span>
          <span className="text-2xl font-black font-mono text-error">
            {formatCurrency(grandTotal)}
          </span>
        </div>
      </div>

      {/* Horizontal Stacked Bar Chart */}
      {grandTotal > 0 ? (
        <div className="w-full h-8 flex rounded-xl overflow-hidden border border-hairline bg-muted/20 mb-6 shadow-inner">
          {pct0_15 > 0 && (
            <button
              onClick={() => setSelectedBucket(selectedBucket === "0_15" ? null : "0_15")}
              className={`h-full bg-emerald-500 hover:brightness-110 active:brightness-95 transition-all duration-150 relative group cursor-pointer ${
                selectedBucket === "0_15" ? "ring-2 ring-emerald-600 ring-offset-2 scale-y-105 z-10" : ""
              }`}
              style={{ width: `${pct0_15}%` }}
              title={`0-15 Days: ${formatCurrency(parseFloat(totals.bucket_0_15))} (${pct0_15.toFixed(1)}%)`}
            />
          )}
          {pct15_30 > 0 && (
            <button
              onClick={() => setSelectedBucket(selectedBucket === "15_30" ? null : "15_30")}
              className={`h-full bg-amber-500 hover:brightness-110 active:brightness-95 transition-all duration-150 relative group cursor-pointer ${
                selectedBucket === "15_30" ? "ring-2 ring-amber-600 ring-offset-2 scale-y-105 z-10" : ""
              }`}
              style={{ width: `${pct15_30}%` }}
              title={`15-30 Days: ${formatCurrency(parseFloat(totals.bucket_15_30))} (${pct15_30.toFixed(1)}%)`}
            />
          )}
          {pct30_60 > 0 && (
            <button
              onClick={() => setSelectedBucket(selectedBucket === "30_60" ? null : "30_60")}
              className={`h-full bg-orange-500 hover:brightness-110 active:brightness-95 transition-all duration-150 relative group cursor-pointer ${
                selectedBucket === "30_60" ? "ring-2 ring-orange-600 ring-offset-2 scale-y-105 z-10" : ""
              }`}
              style={{ width: `${pct30_60}%` }}
              title={`30-60 Days: ${formatCurrency(parseFloat(totals.bucket_30_60))} (${pct30_60.toFixed(1)}%)`}
            />
          )}
          {pct60_plus > 0 && (
            <button
              onClick={() => setSelectedBucket(selectedBucket === "60_plus" ? null : "60_plus")}
              className={`h-full bg-rose-500 hover:brightness-110 active:brightness-95 transition-all duration-150 relative group cursor-pointer ${
                selectedBucket === "60_plus" ? "ring-2 ring-rose-600 ring-offset-2 scale-y-105 z-10" : ""
              }`}
              style={{ width: `${pct60_plus}%` }}
              title={`60+ Days: ${formatCurrency(parseFloat(totals.bucket_60_plus))} (${pct60_plus.toFixed(1)}%)`}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-8 rounded-xl bg-muted/30 flex items-center justify-center text-xs text-ink-muted border border-dashed border-border mb-6">
          No active credit invoices outstandings.
        </div>
      )}

      {/* Legend and stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {(Object.keys(BUCKET_METADATA) as BucketKey[]).map((key) => {
          const meta = BUCKET_METADATA[key];
          const isSelected = selectedBucket === key;
          let val = 0;
          if (key === "0_15") val = parseFloat(totals.bucket_0_15);
          if (key === "15_30") val = parseFloat(totals.bucket_15_30);
          if (key === "30_60") val = parseFloat(totals.bucket_30_60);
          if (key === "60_plus") val = parseFloat(totals.bucket_60_plus);

          return (
            <button
              key={key}
              onClick={() => setSelectedBucket(isSelected ? null : key)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                isSelected
                  ? `border-current ${meta.bgClass} shadow-xs ring-1 ring-current`
                  : "border-hairline bg-surface-2 hover:bg-muted/10"
              }`}
              style={{ color: isSelected ? meta.colorClass.split(" ")[0] : undefined }}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                <span className={`h-2 w-2 rounded-full ${meta.colorClass.split(" ")[1]}`} />
                <span>{meta.label}</span>
              </div>
              <span className="text-base font-bold font-mono text-ink mt-1.5">
                {formatCurrency(val)}
              </span>
              <span className="text-[10px] text-ink-muted mt-0.5 block">
                {getPercentage(val.toString()).toFixed(1)}% of total
              </span>
            </button>
          );
        })}
      </div>

      {/* Drill-down Table Section */}
      {selectedBucket && (
        <div className="mt-6 border-t border-hairline pt-6 animate-fade-in-up">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    BUCKET_METADATA[selectedBucket].colorClass.split(" ")[1]
                  }`}
                />
                <span>Invoice Breakdown ({BUCKET_METADATA[selectedBucket].label})</span>
              </h3>
              <p className="text-[11px] text-ink-muted mt-0.5">
                Listing credit vouchers which are {BUCKET_METADATA[selectedBucket].rangeText}.
              </p>
            </div>

            {/* Search Input inside selected bucket */}
            <div className="relative w-full sm:w-64">
              <SearchIcon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="text"
                placeholder="Search customer / invoice..."
                className="w-full rounded-lg border border-hairline bg-surface-2 pl-9 pr-4 py-1.5 text-xs text-ink outline-none transition placeholder:text-ink-tertiary focus:border-fuel-amber/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="border rounded-xl p-8 text-center text-xs text-ink-muted bg-muted/10">
              No matching invoices found in this bucket.
            </div>
          ) : (
            <div className="overflow-x-auto border border-hairline rounded-xl">
              <table className="w-full text-xs text-left border-collapse bg-surface-1">
                <thead>
                  <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-ink-muted bg-muted/20">
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Invoice No</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Age</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-hairline last:border-0 hover:bg-muted/5 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-semibold text-ink">
                        <div className="flex flex-col">
                          <span>{item.customerName}</span>
                          {item.mobile && (
                            <span className="text-[10px] text-ink-muted font-normal flex items-center gap-1 mt-0.5">
                              <PhoneIcon size={10} />
                              {item.mobile}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-ink-muted">
                        {item.invoice.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">
                        {new Date(item.invoice.invoice_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-rose-500 whitespace-nowrap">
                        {item.invoice.age_days} days late
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatCurrency(item.invoice.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-error">
                        {formatCurrency(item.invoice.balance_due)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex justify-center gap-2">
                          {item.mobile && (
                            <a
                              href={`https://wa.me/${item.mobile.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                                `Dear Customer,\nYour invoice INV-${item.invoice.invoice_number} dated ${item.invoice.invoice_date} is outstanding by ${item.invoice.age_days} days.\nTotal Amount: ₹${item.invoice.total_amount}\nPending Balance: ₹${item.invoice.balance_due}\n\nPlease clear the dues as soon as possible.\nThank you!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-green-600 hover:bg-green-50 transition cursor-pointer"
                              title="Send WhatsApp Reminder"
                            >
                              <PhoneIcon size={12} />
                            </a>
                          )}
                          <Link
                            to={`/dashboard/customers/${item.customerUuid}/ledger`}
                            className="p-1 rounded text-fuel-amber hover:bg-fuel-amber/10 transition cursor-pointer"
                            title="Go to Customer Ledger"
                          >
                            <ArrowRightIcon size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
