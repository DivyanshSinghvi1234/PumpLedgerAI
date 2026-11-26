import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Fuel,
  Landmark,
  Map as MapIcon,
  Moon,
  SlidersHorizontal,
  TabletSmartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";

import api from "@/api/client";
import inventoryService from "@/features/inventory/services/inventoryService";
import type { DailySnapshot } from "@/features/pipeline/services/pipelineService";
import type { DashboardResponse } from "../types/dashboard";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

interface CommandCenterSummary {
  pnl_today: {
    fuel_revenue: number;
    fuel_gross_margin: number;
    other_income: number;
    total_expenses: number;
    stock_loss_value: number;
    true_net_profit: number;
  };
  balance_sheet: {
    cash_in_hand: number;
    bank_balance: number;
    total_liquid_funds: number;
    customer_receivables: number;
  };
  cashflow_forecast: {
    total_upcoming_outflows: number;
    projected_liquid_balance: number;
    low_balance_warning: boolean;
  };
}

type WidgetId = "pulse" | "mix" | "tanks" | "finance";

const WIDGET_LABELS: { id: WidgetId; label: string }[] = [
  { id: "pulse", label: "Station Pulse & Quick Launch" },
  { id: "mix", label: "Payment Mode Mix" },
  { id: "tanks", label: "Underground Tank Levels" },
  { id: "finance", label: "True P&L & Liquid Funds" },
];

const STORAGE_KEY = "pumpledger_bento_widgets_v1";

interface Props {
  dashboard: DashboardResponse;
  snapshot?: DailySnapshot;
}

export default function ExecutiveBentoCockpit({ dashboard, snapshot }: Props) {
  const { t } = useLanguage();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [visibleWidgets, setVisibleWidgets] = useState<Record<WidgetId, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore storage errors
    }
    return { pulse: true, mix: true, tanks: true, finance: true };
  });

  const toggleWidget = (id: WidgetId) => {
    setVisibleWidgets((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const { data: tanks = [] } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  const { data: cc } = useQuery({
    queryKey: ["command-center", 7],
    queryFn: async () => {
      const res = await api.get<CommandCenterSummary>("/v1/command-center", {
        params: { forecast_days: 7 },
      });
      return res.data;
    },
  });

  const meterSales = snapshot?.meters.gross_meter_sales ?? dashboard.summary.today_sales;
  const voucherSales = snapshot?.vouchers.total_voucher_sales ?? dashboard.summary.today_sales;
  const coveragePct = meterSales > 0 ? Math.min(100, Math.round((voucherSales / meterSales) * 100)) : 100;

  // Payment mix segments for SVG donut
  const segments = [
    { key: "Cash", value: snapshot?.vouchers.cash_sales ?? 0, color: "#10b981" },
    { key: "UPI", value: snapshot?.vouchers.upi_sales ?? 0, color: "#3b82f6" },
    { key: "Credit", value: snapshot?.vouchers.credit_sales ?? 0, color: "#f59e0b" },
    {
      key: "Card/Bank",
      value: (snapshot?.vouchers.card_sales ?? 0) + (snapshot?.vouchers.bank_sales ?? 0),
      color: "#8b5cf6",
    },
  ];
  const totalMix = segments.reduce((acc, s) => acc + s.value, 0);

  return (
    <section className="space-y-3">
      {/* Cockpit Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse-live" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            {t("Executive Bento Cockpit")}
          </h2>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setCustomizeOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-2.5 py-1 text-xs font-medium text-ink-muted hover:text-ink hover:border-hairline-strong transition cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            {t("Customize")}
          </button>
          {customizeOpen && (
            <div className="absolute right-0 top-8 z-30 w-60 rounded-xl border border-hairline bg-surface-1 p-3 shadow-xl space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                Visible Cockpit Widgets
              </p>
              {WIDGET_LABELS.map((w) => (
                <label
                  key={w.id}
                  className="flex items-center justify-between gap-2 text-xs text-ink cursor-pointer py-1"
                >
                  <span>{w.label}</span>
                  <input
                    type="checkbox"
                    checked={visibleWidgets[w.id]}
                    onChange={() => toggleWidget(w.id)}
                    className="accent-fuel-orange h-3.5 w-3.5"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 1. Station Pulse & Quick Launch (2 cols) */}
        {visibleWidgets.pulse && (
          <div className="bento-card md:col-span-2 p-5 flex flex-col justify-between gap-4 bg-gradient-to-br from-surface-1 via-surface-1 to-surface-2/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Today&apos;s Forecourt Revenue
                </p>
                <div className="mt-1 flex items-baseline gap-2.5">
                  <span className="text-3xl font-extrabold tracking-tight text-ink tabular-nums">
                    {formatCurrency(meterSales)}
                  </span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {snapshot?.meters.total_liters
                      ? `${snapshot.meters.total_liters.toLocaleString("en-IN", { maximumFractionDigits: 0 })} L`
                      : `${dashboard.summary.today_vouchers} slips`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    snapshot?.is_locked
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                  }`}
                >
                  {snapshot?.is_locked ? "Day Locked" : "Shift Open"}
                </span>
              </div>
            </div>

            {/* Meter vs Voucher Reconciliation Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted font-medium">
                  Billed Vouchers vs Meter Sales
                </span>
                <span className="font-bold text-ink tabular-nums">
                  {formatCurrency(voucherSales)} ({coveragePct}%)
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fuel-amber to-fuel-orange transition-all duration-500"
                  style={{ width: `${coveragePct}%` }}
                />
              </div>
            </div>

            {/* Quick Launch Action Pills */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Link
                to="/dashboard/forecourt-twin"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface-2/80 px-3 py-2 text-xs font-semibold text-ink hover:border-fuel-amber/60 hover:bg-fuel-amber/10 transition"
              >
                <MapIcon size={14} className="text-fuel-amber shrink-0" />
                <span className="truncate">Station Twin</span>
              </Link>
              <Link
                to="/dashboard/close-day"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface-2/80 px-3 py-2 text-xs font-semibold text-ink hover:border-indigo-500/60 hover:bg-indigo-500/10 transition"
              >
                <Moon size={14} className="text-indigo-500 shrink-0" />
                <span className="truncate">Close Day</span>
              </Link>
              <Link
                to="/dashboard/pos"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface-2/80 px-3 py-2 text-xs font-semibold text-ink hover:border-emerald-500/60 hover:bg-emerald-500/10 transition"
              >
                <TabletSmartphone size={14} className="text-emerald-500 shrink-0" />
                <span className="truncate">POS Kiosk</span>
              </Link>
            </div>
          </div>
        )}

        {/* 2. Payment Mode Mix Donut (1 col) */}
        {visibleWidgets.mix && (
          <div className="bento-card p-5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Collection Mix
              </p>
              <Activity size={15} className="text-fuel-amber" />
            </div>

            <div className="flex items-center gap-4">
              {/* Pure SVG Donut */}
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="var(--pl-surface-3)"
                    strokeWidth="4.5"
                  />
                  {(() => {
                    let offset = 0;
                    const circumference = 2 * Math.PI * 14;
                    return segments.map((seg) => {
                      const pct = totalMix > 0 ? seg.value / totalMix : 0;
                      const dash = pct * circumference;
                      const el = (
                        <circle
                          key={seg.key}
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={hoveredSlice === seg.key ? "5.5" : "4.5"}
                          strokeDasharray={`${dash} ${circumference}`}
                          strokeDashoffset={-offset}
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredSlice(seg.key)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        />
                      );
                      offset += dash;
                      return el;
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] font-medium text-ink-subtle">
                    {hoveredSlice ?? "Total"}
                  </span>
                  <span className="text-xs font-bold text-ink tabular-nums">
                    {hoveredSlice
                      ? `${Math.round(
                          ((segments.find((s) => s.key === hoveredSlice)?.value ?? 0) /
                            (totalMix || 1)) *
                            100
                        )}%`
                      : formatCurrency(totalMix)}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                {segments.map((seg) => (
                  <div
                    key={seg.key}
                    onMouseEnter={() => setHoveredSlice(seg.key)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    className="flex items-center justify-between text-xs cursor-default"
                  >
                    <span className="flex items-center gap-1.5 text-ink-muted truncate">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      {seg.key}
                    </span>
                    <span className="font-semibold text-ink tabular-nums">
                      {formatCurrency(seg.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Underground Tank Levels (1 col) */}
        {visibleWidgets.tanks && (
          <div className="bento-card p-5 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Tank Telemetry
              </p>
              <Link
                to="/dashboard/forecourt-twin"
                className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-fuel-amber hover:underline"
              >
                Live Twin <ArrowUpRight size={12} />
              </Link>
            </div>

            <div className="space-y-2.5">
              {tanks.length === 0 ? (
                <p className="text-xs text-ink-muted">No tanks configured yet.</p>
              ) : (
                tanks.slice(0, 3).map((tank) => {
                  const pct =
                    tank.capacity_liters > 0
                      ? Math.min(100, Math.round((tank.current_stock_liters / tank.capacity_liters) * 100))
                      : 0;
                  const barColor =
                    tank.fuel_type === "DIESEL"
                      ? "bg-amber-500"
                      : tank.fuel_type === "SPEED"
                      ? "bg-emerald-500"
                      : "bg-blue-500";
                  return (
                    <div key={tank.uuid} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink flex items-center gap-1.5 truncate">
                          <Fuel size={12} className="text-ink-subtle shrink-0" />
                          {tank.name}
                        </span>
                        <span className="tabular-nums text-ink-muted font-medium">
                          {tank.current_stock_liters.toLocaleString("en-IN", { maximumFractionDigits: 0 })} L ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className={`h-full rounded-full ${pct < 20 ? "bg-rose-500" : barColor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* 4. True P&L & Liquid Funds Strip (4 cols when visible) */}
        {visibleWidgets.finance && cc && (
          <div className="bento-card md:col-span-2 xl:col-span-4 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-hairline">
              <div className="flex items-center gap-3 pt-1 sm:pt-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-ink-subtle">True Net Profit (Today)</p>
                  <p className="text-base font-bold text-ink tabular-nums truncate">
                    {formatCurrency(cc.pnl_today.true_net_profit)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:pl-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                  <Wallet size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-ink-subtle">Cash in Hand</p>
                  <p className="text-base font-bold text-ink tabular-nums truncate">
                    {formatCurrency(cc.balance_sheet.cash_in_hand)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:pl-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 shrink-0">
                  <Landmark size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-ink-subtle">Bank Balance</p>
                  <p className="text-base font-bold text-ink tabular-nums truncate">
                    {formatCurrency(cc.balance_sheet.bank_balance)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:pl-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 shrink-0">
                  <Activity size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-ink-subtle">7-Day Projected Liquid</p>
                  <p
                    className={`text-base font-bold tabular-nums truncate ${
                      cc.cashflow_forecast.low_balance_warning ? "text-rose-500" : "text-ink"
                    }`}
                  >
                    {formatCurrency(cc.cashflow_forecast.projected_liquid_balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
