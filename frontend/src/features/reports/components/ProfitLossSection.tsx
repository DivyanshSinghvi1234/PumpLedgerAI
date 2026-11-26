import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import api from "@/api/client";
import { formatCurrency } from "@/lib/utils";

interface PnLCategoryRow {
  category: string;
  amount: number;
}

interface PnLReportResponse {
  from_date: string;
  to_date: string;
  fuel_revenue: number;
  fuel_liters: number;
  fuel_cogs: number;
  fuel_gross_margin: number;
  commission_profit?: number;
  margin_source?: string;
  commission_rates?: Record<string, number>;
  other_income: number;
  total_expenses: number;
  shift_variance: number;
  net_profit: number;
  expense_by_category: PnLCategoryRow[];
}

export default function ProfitLossSection() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const { data, isLoading, isError } = useQuery<PnLReportResponse>({
    queryKey: ["report-pnl", fromDate, toDate],
    queryFn: async () => {
      const res = await api.get<PnLReportResponse>("/v1/reports/pnl", {
        params: { from_date: fromDate, to_date: toDate },
      });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Calculating Profit &amp; Loss…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-600">Failed to load Profit &amp; Loss report.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Fuel Revenue ({Number(data.fuel_liters).toFixed(1)} L)</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(data.fuel_revenue)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Gross Fuel Margin</p>
              <p className="text-lg font-bold mt-1 text-emerald-600">{formatCurrency(data.fuel_gross_margin)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Operating Expenses</p>
              <p className="text-lg font-bold mt-1 text-red-600">{formatCurrency(data.total_expenses)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Net Profit</p>
              <p className={`text-lg font-bold mt-1 ${data.net_profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {formatCurrency(data.net_profit)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
              <h3 className="font-semibold">P&amp;L Breakdown</h3>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Fuel Sales Revenue</span>
                <span className="font-mono">{formatCurrency(data.fuel_revenue)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Less: Depot Fuel Cost (COGS)</span>
                <span className="font-mono text-red-600">-{formatCurrency(data.fuel_cogs)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50 font-medium">
                <span>
                  Gross Fuel Margin
                  {data.margin_source && (
                    <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                      ({data.margin_source.toLowerCase()})
                    </span>
                  )}
                </span>
                <span className="font-mono">{formatCurrency(data.fuel_gross_margin)}</span>
              </div>
              {Number(data.commission_profit ?? 0) > 0 && (
                <div className="flex justify-between py-1 border-b border-border/50 text-xs">
                  <span className="text-muted-foreground">Commission Profit (₹/L)</span>
                  <span className="font-mono text-emerald-600">{formatCurrency(data.commission_profit ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Plus: Other Income</span>
                <span className="font-mono text-emerald-600">+{formatCurrency(data.other_income)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Plus/Minus: Shift Cash Variance</span>
                <span className="font-mono">{formatCurrency(data.shift_variance)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Less: Total Expenses &amp; Salaries</span>
                <span className="font-mono text-red-600">-{formatCurrency(data.total_expenses)}</span>
              </div>
              <div className="flex justify-between pt-2 font-bold">
                <span>Net Profit</span>
                <span className={`font-mono ${data.net_profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(data.net_profit)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
              <h3 className="font-semibold">Expenses by Category</h3>
              {data.expense_by_category.length === 0 ? (
                <p className="text-xs text-muted-foreground">No expenses recorded in this period.</p>
              ) : (
                data.expense_by_category.map((row) => (
                  <div key={row.category} className="flex justify-between py-1 border-b border-border/50">
                    <span>{row.category}</span>
                    <span className="font-mono font-medium">{formatCurrency(row.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
