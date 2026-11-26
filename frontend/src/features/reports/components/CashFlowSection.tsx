import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import api from "@/api/client";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/common/LoadingState";

interface CashFlowData {
  from_date: string;
  to_date: string;
  money_in: {
    cash_sales: number;
    digital_sales: number;
    customer_payments: number;
    other_income: number;
  };
  money_out: {
    fuel_lube_purchases: number;
    staff_payroll: number;
    operating_expenses: number;
  };
  total_in: number;
  total_out: number;
  net_cash_flow: number;
}

export default function CashFlowSection() {
  const today = getTodayDateString();
  const monthStart = `${today.slice(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ["report-cash-flow", fromDate, toDate],
    queryFn: async () => {
      const res = await api.get<CashFlowData>("/v1/reports/cash-flow", {
        params: { from_date: fromDate, to_date: toDate },
      });
      return res.data;
    },
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">From:</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">To:</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40 h-9 text-xs"
          />
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-ink-subtle flex items-center justify-between">
              Total Money In
              <ArrowDownLeft size={16} className="text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-emerald-400">
              {formatCurrency(data.total_in)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-ink-subtle flex items-center justify-between">
              Total Money Out
              <ArrowUpRight size={16} className="text-rose-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono text-rose-400">
              {formatCurrency(data.total_out)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-hairline bg-surface-2/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-ink-subtle flex items-center justify-between">
              Net Cash Flow
              <Wallet size={16} className="text-fuel-amber" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold font-mono ${
                data.net_cash_flow >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {data.net_cash_flow >= 0 ? "+" : ""}
              {formatCurrency(data.net_cash_flow)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Money In vs Money Out */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass border-hairline">
          <CardHeader className="pb-2 border-b border-hairline">
            <CardTitle className="text-sm font-bold text-emerald-400">Money In (Inflows)</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">Cash Fuel / Lube Vouchers</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_in.cash_sales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Digital Vouchers (UPI / Card / Bank)</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_in.digital_sales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Customer Credit Payments Received</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_in.customer_payments)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Other Income / Register Receipts</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_in.other_income)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardHeader className="pb-2 border-b border-hairline">
            <CardTitle className="text-sm font-bold text-rose-400">Money Out (Outflows)</CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-muted">Fuel &amp; Lubricant Purchases</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_out.fuel_lube_purchases)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Staff Salaries &amp; Advances</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_out.staff_payroll)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Operating &amp; Misc Expenses</span>
              <span className="font-mono font-bold text-ink">{formatCurrency(data.money_out.operating_expenses)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
