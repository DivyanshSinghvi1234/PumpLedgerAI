import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Fuel,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import api from "@/api/client";
import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import { formatCurrency, getTodayDateString } from "@/lib/utils";

interface CommandCenterData {
  as_of: string;
  forecast_days: number;
  pnl_today: {
    fuel_revenue: number;
    fuel_gross_margin: number;
    other_income: number;
    total_expenses: number;
    stock_loss_value: number;
    true_net_profit: number;
  };
  pnl_mtd: {
    fuel_revenue: number;
    fuel_gross_margin: number;
    other_income: number;
    total_expenses: number;
    stock_loss_value: number;
    true_net_profit: number;
    expense_by_category: Array<{ category: string; amount: number }>;
  };
  balance_sheet: {
    cash_in_hand: number;
    bank_balance: number;
    total_liquid_funds: number;
    customer_receivables: number;
    fuel_stock_liters: number;
    fuel_stock_value: number;
    omc_payables: number;
    net_working_capital: number;
  };
  cashflow_forecast: {
    total_upcoming_outflows: number;
    projected_liquid_balance: number;
    low_balance_warning: boolean;
    items: Array<{
      type: string;
      title: string;
      due_date: string;
      amount: number;
    }>;
  };
}

export default function CommandCenterPage() {
  const queryClient = useQueryClient();
  const [forecastDays, setForecastDays] = useState(14);

  // 6 AM Price Revision Quick Scheduler
  const [revDate, setRevDate] = useState(getTodayDateString());
  const [petrolRate, setPetrolRate] = useState("");
  const [dieselRate, setDieselRate] = useState("");
  const [speedRate, setSpeedRate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["command-center", forecastDays],
    queryFn: async () => {
      const res = await api.get<CommandCenterData>("/v1/command-center", {
        params: { forecast_days: forecastDays },
      });
      return res.data;
    },
  });

  const { data: sixAmAlert } = useQuery({
    queryKey: ["price-6am-alert"],
    queryFn: async () => {
      const res = await api.get<{
        has_price_change: boolean;
        changes: Array<{ fuel_type: string; old_rate: number; new_rate: number; diff: number }>;
      }>("/v1/price-schedules/6am-alert");
      return res.data;
    },
  });

  const schedule6AmMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string | number> = { effective_date: revDate };
      if (petrolRate) payload.petrol_rate = Number(petrolRate);
      if (dieselRate) payload.diesel_rate = Number(dieselRate);
      if (speedRate) payload.speed_rate = Number(speedRate);
      const res = await api.post("/v1/price-schedules/schedule-6am", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("6:00 AM fuel price revision scheduled!");
      setPetrolRate("");
      setDieselRate("");
      setSpeedRate("");
      queryClient.invalidateQueries({ queryKey: ["price-6am-alert"] });
      queryClient.invalidateQueries({ queryKey: ["command-center"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to schedule 6 AM price"),
  });

  if (isLoading || !data) {
    return <LoadingState />;
  }

  const { pnl_today, pnl_mtd, balance_sheet, cashflow_forecast } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner Financial Command Center"
        description="Live True P&L (with stock loss), Balance Sheet Snapshot, 14-Day Cashflow Forecast & 6 AM Price Autopilot."
        action={
          <select
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
            className="rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-xs font-semibold text-ink"
          >
            <option value={7}>7-Day Forecast</option>
            <option value={14}>14-Day Forecast</option>
            <option value={30}>30-Day Forecast</option>
          </select>
        }
      />

      {sixAmAlert?.has_price_change && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-ink">
                6:00 AM Price Change Active Today — Interim Nozzle Readings Required
              </p>
              <p className="text-xs text-ink-muted">
                {sixAmAlert.changes
                  .map(
                    (c) =>
                      `${c.fuel_type}: ${formatCurrency(c.old_rate)} → ${formatCurrency(c.new_rate)} (${c.diff > 0 ? "+" : ""}${c.diff})`
                  )
                  .join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Balance Sheet / Net Working Capital */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-hairline bg-card p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Cash in Hand</span>
            <Wallet className="h-4 w-4 text-fuel-amber" />
          </div>
          <p className="mt-2 text-lg font-bold font-mono text-ink">
            {formatCurrency(balance_sheet.cash_in_hand)}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-card p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Bank Balances</span>
            <Landmark className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-lg font-bold font-mono text-ink">
            {formatCurrency(balance_sheet.bank_balance)}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-card p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Customer Receivables</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-lg font-bold font-mono text-emerald-500">
            {formatCurrency(balance_sheet.customer_receivables)}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-card p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Fuel Stock Value ({balance_sheet.fuel_stock_liters.toLocaleString("en-IN")} L)</span>
            <Fuel className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-lg font-bold font-mono text-ink">
            {formatCurrency(balance_sheet.fuel_stock_value)}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-emerald-500 font-semibold">
            <span>Net Working Capital</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <p className="mt-2 text-lg font-extrabold font-mono text-ink">
            {formatCurrency(balance_sheet.net_working_capital)}
          </p>
          {balance_sheet.omc_payables > 0 && (
            <p className="text-[11px] text-ink-muted mt-0.5">
              Net of {formatCurrency(balance_sheet.omc_payables)} OMC payables
            </p>
          )}
        </div>
      </div>

      {/* Row 2: True P&L Today vs MTD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[
          { label: "Today's True P&L", pnl: pnl_today },
          { label: "Month-to-Date (MTD) True P&L", pnl: pnl_mtd },
        ].map(({ label, pnl }) => (
          <div key={label} className="rounded-xl border border-hairline bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Activity className="h-4 w-4 text-fuel-amber" />
                {label}
              </h3>
              <span
                className={`text-sm font-extrabold font-mono ${
                  pnl.true_net_profit >= 0 ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {pnl.true_net_profit >= 0 ? "+" : ""}
                {formatCurrency(pnl.true_net_profit)}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">Fuel Revenue</span>
                <span className="font-mono font-semibold">{formatCurrency(pnl.fuel_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Fuel Gross Margin</span>
                <span className="font-mono text-emerald-500">+{formatCurrency(pnl.fuel_gross_margin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Other Income</span>
                <span className="font-mono text-emerald-500">+{formatCurrency(pnl.other_income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Operating Expenses & Salaries</span>
                <span className="font-mono text-rose-500">−{formatCurrency(pnl.total_expenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Unexplained Stock Loss Value</span>
                <span className="font-mono text-rose-500">−{formatCurrency(pnl.stock_loss_value)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 3: Cashflow Forecast + 6 AM Price Revision Autopilot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-hairline bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <ArrowDownRight className="h-4 w-4 text-rose-500" />
                {forecastDays}-Day Cashflow Forecast
              </h3>
              <p className="text-xs text-ink-muted">
                Upcoming recurring bills, tanker indents, and unpaid payroll.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-ink-muted">Projected Liquid Balance</p>
              <p
                className={`text-base font-extrabold font-mono ${
                  cashflow_forecast.low_balance_warning ? "text-rose-500" : "text-emerald-500"
                }`}
              >
                {formatCurrency(cashflow_forecast.projected_liquid_balance)}
              </p>
            </div>
          </div>

          {cashflow_forecast.low_balance_warning && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 flex items-center gap-2 text-xs text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Projected liquid balance drops below ₹50,000 after upcoming obligations ({formatCurrency(cashflow_forecast.total_upcoming_outflows)}).
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-2">
            {cashflow_forecast.items.length === 0 ? (
              <p className="text-xs text-ink-muted py-4 text-center">
                No upcoming outflows scheduled in the next {forecastDays} days.
              </p>
            ) : (
              cashflow_forecast.items.map((item, idx) => (
                <div
                  key={`${item.type}-${idx}`}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-ink">{item.title}</span>
                    <span className="ml-2 text-[11px] text-ink-muted">
                      {item.type.replace("_", " ")} · Due {item.due_date}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-rose-500">
                    −{formatCurrency(item.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 6 AM Price Revision Autopilot */}
        <div className="rounded-xl border border-hairline bg-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              <Clock className="h-4 w-4 text-fuel-amber" />
              6:00 AM Fuel Price Revision Autopilot
            </h3>
            <p className="text-xs text-ink-muted">
              Schedule an OMC rate change for 6:00 AM. Attendants will automatically see an interim-reading reminder on that date.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Effective Date</label>
              <input
                type="date"
                value={revDate}
                onChange={(e) => setRevDate(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Petrol (₹/L)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 104.50"
                value={petrolRate}
                onChange={(e) => setPetrolRate(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-xs text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Diesel (₹/L)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 90.20"
                value={dieselRate}
                onChange={(e) => setDieselRate(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-xs text-ink font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Speed (₹/L)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Optional"
                value={speedRate}
                onChange={(e) => setSpeedRate(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-xs text-ink font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={(!petrolRate && !dieselRate && !speedRate) || schedule6AmMutation.isPending}
              onClick={() => schedule6AmMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-lg bg-fuel-amber px-4 py-2 text-xs font-semibold text-canvas hover:bg-fuel-amber/90 disabled:opacity-50 cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5" />
              {schedule6AmMutation.isPending ? "Scheduling..." : "Schedule 6:00 AM Revision"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
