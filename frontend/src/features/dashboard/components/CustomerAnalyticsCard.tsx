import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, Trophy, Heart, AlertTriangle, Moon, RefreshCw } from "lucide-react";

import api from "@/api/client";
import { formatCurrency } from "@/lib/utils";

interface CustomerRFM {
  customer_uuid: string;
  customer_name: string;
  customer_code: string | null;
  mobile: string | null;
  recency_days: number;
  frequency: number;
  monetary_value: number;
  segment: string;
  dormancy_date: string | null;
}

interface ChurnData {
  segments: {
    Champions: number;
    Loyal: number;
    "At Risk": number;
    Hibernating: number;
  };
  customers: CustomerRFM[];
}

const SIZE = 160;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

const SEGMENT_METADATA: Record<
  string,
  { label: string; color: string; hoverColor: string; icon: any; textClass: string; bgClass: string }
> = {
  Champions: {
    label: "Champions",
    color: "#3b82f6", // Blue
    hoverColor: "#60a5fa",
    icon: Trophy,
    textClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
  },
  Loyal: {
    label: "Loyal",
    color: "#10b981", // Green
    hoverColor: "#34d399",
    icon: Heart,
    textClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
  },
  "At Risk": {
    label: "At Risk",
    color: "#f59e0b", // Amber
    hoverColor: "#fbbf24",
    icon: AlertTriangle,
    textClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  Hibernating: {
    label: "Hibernating",
    color: "#6b7280", // Gray
    hoverColor: "#9ca3af",
    icon: Moon,
    textClass: "text-zinc-400",
    bgClass: "bg-zinc-500/10",
  },
};

export default function CustomerAnalyticsCard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);

  const { data, isLoading, refetch, isRefetching } = useQuery<ChurnData>({
    queryKey: ["customer-churn-rfm"],
    queryFn: async () => {
      const res = await api.get("/v1/analytics/churn");
      return res.data;
    },
  });

  // Animate Donut on load
  useEffect(() => {
    if (data) {
      setAnimationProgress(0);
      const timer = setTimeout(() => setAnimationProgress(1), 100);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="card-glow rounded-xl border border-hairline bg-surface-1 p-6 h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-ink-subtle">Computing loyalty segments...</span>
        </div>
      </div>
    );
  }

  const { segments, customers } = data;
  const totalCustomers = customers.length;

  const donutSegments = Object.entries(segments).map(([name, count]) => ({
    name,
    count,
    meta: SEGMENT_METADATA[name] || {
      label: name,
      color: "#9ca3af",
      hoverColor: "#d1d5db",
      icon: Moon,
      textClass: "text-zinc-500",
      bgClass: "bg-zinc-500/10",
    },
  }));

  const totalSegmentCounts = donutSegments.reduce((sum, seg) => sum + seg.count, 0);

  // Filter customers by selected segment & search query
  const filteredCustomers = customers.filter((c) => {
    const matchesSegment = selectedSegment ? c.segment === selectedSegment : true;
    const matchesSearch = searchQuery
      ? c.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.customer_code && c.customer_code.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesSegment && matchesSearch;
  });

  let offset = 0;

  return (
    <div className="card-glow rounded-xl border border-hairline bg-surface-1 p-6 transition-all duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
            Loyalty & RFM Customer Analytics
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="text-ink-muted hover:text-ink transition active:scale-95 disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </button>
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Credit client segmentation based on Recency, Frequency, and Monetary parameters.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
            Total Credit Clients
          </span>
          <span className="text-2xl font-black font-mono text-ink">
            {totalCustomers}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: SVG Donut Chart */}
        <div className="lg:col-span-1 flex flex-col items-center gap-6">
          <div className="relative">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="-rotate-90"
            >
              {/* Background ring */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="#27272a"
                strokeWidth={STROKE}
              />
              {/* Segments */}
              {donutSegments.map((seg) => {
                if (seg.count === 0 || totalSegmentCounts === 0) return null;
                const frac = seg.count / totalSegmentCounts;
                const dash = frac * CIRC * animationProgress;
                const strokeOffset = -offset * animationProgress;
                
                const isSelected = selectedSegment === seg.name;
                const isAnySelected = selectedSegment !== null;

                const circleEl = (
                  <circle
                    key={seg.name}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={seg.meta.color}
                    strokeWidth={isSelected ? STROKE + 4 : STROKE}
                    strokeDasharray={`${dash} ${CIRC - dash}`}
                    strokeDashoffset={strokeOffset}
                    strokeLinecap="butt"
                    className="transition-all duration-300 ease-out cursor-pointer"
                    style={{
                      opacity: !isAnySelected || isSelected ? 1 : 0.35,
                      filter: isSelected ? `drop-shadow(0 0 6px ${seg.meta.color}80)` : `drop-shadow(0 0 2px ${seg.meta.color}20)`,
                    }}
                    onClick={() => setSelectedSegment(isSelected ? null : seg.name)}
                  />
                );
                offset += frac * CIRC;
                return circleEl;
              })}
            </svg>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-ink">
                {selectedSegment ? segments[selectedSegment as keyof typeof segments] : totalCustomers}
              </span>
              <span className="text-[9px] font-mono text-ink-subtle uppercase tracking-wider text-center">
                {selectedSegment ? `${selectedSegment}` : "clients"}
              </span>
            </div>
          </div>

          {/* Donut Legend */}
          <div className="w-full space-y-2">
            {donutSegments.map((seg) => {
              const Icon = seg.meta.icon;
              const percent = totalSegmentCounts
                ? Math.round((seg.count / totalSegmentCounts) * 100)
                : 0;
              const isSelected = selectedSegment === seg.name;
              return (
                <button
                  key={seg.name}
                  onClick={() => setSelectedSegment(isSelected ? null : seg.name)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition text-left ${
                    isSelected ? "bg-surface-3 border border-hairline" : "hover:bg-surface-2 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full`}
                      style={{
                        background: seg.meta.color,
                        boxShadow: `0 0 6px ${seg.meta.color}50`,
                      }}
                    />
                    <Icon className={`h-3.5 w-3.5 ${seg.meta.textClass}`} />
                    <span className="text-xs font-semibold text-ink">
                      {seg.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-ink-muted">
                      {seg.count}
                    </span>
                    <span className="text-[10px] text-ink-subtle bg-surface-3 px-1.5 py-0.5 rounded font-mono">
                      {percent}%
                    </span>
                  </div>
                </button>
              );
            })}
            {selectedSegment && (
              <button
                onClick={() => setSelectedSegment(null)}
                className="w-full text-center text-xs text-primary font-semibold mt-1 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Table list of segmented customers */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-ink-subtle pointer-events-none" />
              <input
                type="text"
                placeholder="Search clients by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-hairline bg-surface-2 text-ink placeholder-ink-subtle focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
              />
            </div>
            {selectedSegment && (
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md border border-hairline font-mono ${SEGMENT_METADATA[selectedSegment].bgClass} ${SEGMENT_METADATA[selectedSegment].textClass}`}>
                {selectedSegment.toUpperCase()}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-hairline max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2 border-b border-hairline text-ink-muted font-bold">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-right">Recency (Days)</th>
                  <th className="p-3 text-right">Frequency</th>
                  <th className="p-3 text-right">Total Spent</th>
                  <th className="p-3">Dormancy Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline bg-surface-1">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-ink-subtle">
                      No matching clients found in this segment.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const meta = SEGMENT_METADATA[cust.segment] || {
                      textClass: "text-zinc-500",
                      bgClass: "bg-zinc-500/10",
                    };
                    return (
                      <tr key={cust.customer_uuid} className="hover:bg-surface-2/40 transition">
                        <td className="p-3">
                          <div className="font-semibold text-ink">{cust.customer_name}</div>
                          <div className="text-[10px] text-ink-subtle font-mono mt-0.5">
                            {cust.customer_code || "No Code"}
                            {cust.mobile && ` • ${cust.mobile}`}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-ink">
                          {cust.recency_days === 999 ? (
                            <span className="text-ink-subtle">N/A</span>
                          ) : (
                            cust.recency_days
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-ink">
                          {cust.frequency}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-ink">
                          {formatCurrency(cust.monetary_value)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-ink-muted">
                              {cust.dormancy_date || "Never"}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono ${meta.bgClass} ${meta.textClass}`}>
                              {cust.segment}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
