import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Droplets, TrendingDown } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AppDialog from "@/components/common/AppDialog";
import dayClosingService from "@/features/day-closing/services/dayClosingService";
import type { StockVarianceItem } from "@/features/day-closing/types/dayClosing";
import { formatCurrency, getTodayDateString } from "@/lib/utils";

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  OK: { badge: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", label: "OK" },
  WARNING: { badge: "bg-amber-500/15 text-amber-500 border-amber-500/30", label: "Warning" },
  CRITICAL: { badge: "bg-rose-500/15 text-rose-500 border-rose-500/30", label: "Critical" },
  PENDING_DIP: { badge: "bg-surface-2 text-ink-muted border-hairline", label: "Pending Dip" },
};

export default function StockVarianceCard() {
  const today = getTodayDateString();
  const [selectedTank, setSelectedTank] = useState<StockVarianceItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-variance-daily", today],
    queryFn: () => dayClosingService.getDailyStockVariance(today),
  });

  const { data: trend = [], isLoading: trendLoading } = useQuery({
    queryKey: ["stock-variance-trend", selectedTank?.tank_uuid],
    queryFn: () => dayClosingService.getTankTrend(selectedTank!.tank_uuid, 14),
    enabled: Boolean(selectedTank?.tank_uuid),
  });

  if (isLoading) {
    return (
      <Card className="glass border-hairline">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
            <Droplets size={15} className="text-fuel-amber" /> Tank Stock Accountability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-ink-muted">Checking book stock vs physical dips...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.items.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="glass border-hairline">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
              <Droplets size={15} className="text-fuel-amber" /> Tank Stock Loss Detection
            </CardTitle>
            <CardDescription className="text-[11px] text-ink-subtle">
              Daily Book Stock vs Physical Dip (tolerance ±{data.threshold_percent}%). Click a tank for 14-day trend.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((a) => (
                <div
                  key={a.tank_uuid}
                  className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500 font-medium"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.items.map((item) => {
              const st = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING_DIP;
              return (
                <button
                  key={item.tank_uuid}
                  type="button"
                  onClick={() => setSelectedTank(item)}
                  className="text-left rounded-xl border border-hairline bg-surface-2/60 p-4 hover:border-fuel-amber/50 transition-all space-y-2 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink truncate">{item.tank_name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.badge}`}>
                      {st.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1 text-xs">
                    <span className="text-ink-muted">Book Stock:</span>
                    <span className="text-right font-mono font-medium">{item.book_stock.toFixed(1)} L</span>

                    <span className="text-ink-muted">Physical Dip:</span>
                    <span className="text-right font-mono font-medium">
                      {item.physical_dip !== null ? `${item.physical_dip.toFixed(1)} L` : "Not entered"}
                    </span>

                    <span className="text-ink-muted">Meter Sold Today:</span>
                    <span className="text-right font-mono">{item.meter_sales.toFixed(1)} L</span>
                  </div>

                  {item.variance_liters !== null && (
                    <div className="flex items-center justify-between border-t border-hairline pt-2 text-xs font-bold">
                      <span className="text-ink-muted">Variance:</span>
                      <span className={`font-mono ${item.variance_liters < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                        {item.variance_liters > 0 ? "+" : ""}
                        {item.variance_liters.toFixed(1)} L ({item.variance_percent?.toFixed(2)}%)
                        {item.variance_amount !== null ? ` · ${formatCurrency(item.variance_amount)}` : ""}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AppDialog
        open={Boolean(selectedTank)}
        onOpenChange={(open) => {
          if (!open) setSelectedTank(null);
        }}
        title={selectedTank ? `${selectedTank.tank_name} — 14-Day Variance Trend` : "Variance Trend"}
      >
        {trendLoading ? (
          <p className="text-xs text-ink-muted py-4">Loading variance history...</p>
        ) : trend.length === 0 ? (
          <p className="text-xs text-ink-muted py-4">No variance history recorded for this tank yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <TrendingDown className="h-4 w-4 text-fuel-amber" />
              <span>Daily physical dip vs book stock variance (litres)</span>
            </div>

            {/* Simple SVG bar chart */}
            <div className="rounded-lg border border-hairline bg-surface-2 p-3">
              <div className="flex items-end gap-1.5 h-28">
                {(() => {
                  const maxAbs = Math.max(
                    ...trend.map((t) => Math.abs(t.variance_liters || 0)),
                    10
                  );
                  return trend.map((t) => {
                    const val = t.variance_liters ?? 0;
                    const heightPct = Math.max(8, Math.round((Math.abs(val) / maxAbs) * 100));
                    const barColor =
                      t.status === "CRITICAL"
                        ? "bg-rose-500"
                        : t.status === "WARNING"
                        ? "bg-amber-500"
                        : t.status === "OK"
                        ? "bg-emerald-500"
                        : "bg-ink-muted/30";
                    return (
                      <div key={t.uuid} className="flex-1 flex flex-col items-center gap-1" title={`${t.variance_date}: ${val} L`}>
                        <div className="w-full flex items-end justify-center h-20">
                          <div className={`w-full max-w-[18px] rounded-t ${barColor}`} style={{ height: `${heightPct}%` }} />
                        </div>
                        <span className="text-[9px] font-mono text-ink-muted">
                          {t.variance_date.slice(5)}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-surface-2 text-ink-muted uppercase">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-right">Book (L)</th>
                    <th className="px-2 py-1.5 text-right">Dip (L)</th>
                    <th className="px-2 py-1.5 text-right">Variance</th>
                    <th className="px-2 py-1.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((row) => (
                    <tr key={row.uuid} className="border-t border-hairline">
                      <td className="px-2 py-1.5 font-mono">{row.variance_date}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{row.book_stock.toFixed(1)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {row.physical_dip !== null ? row.physical_dip.toFixed(1) : "—"}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono font-semibold ${(row.variance_liters ?? 0) < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                        {row.variance_liters !== null ? `${row.variance_liters > 0 ? "+" : ""}${row.variance_liters.toFixed(1)} L` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AppDialog>
    </>
  );
}
