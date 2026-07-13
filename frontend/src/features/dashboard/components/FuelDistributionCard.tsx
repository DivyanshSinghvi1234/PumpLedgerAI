import { useState, useEffect } from "react";

import type { FuelDistribution } from "../types/dashboard";

interface Props {
  distribution: FuelDistribution;
}

interface Segment {
  label: string;
  value: number;
  color: string;
  hoverColor: string;
}

const SIZE = 180;
const STROKE = 24;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function FuelDistributionCard({
  distribution,
}: Props) {
  const [animationProgress, setAnimationProgress] = useState(0);

  const segments: Segment[] = [
    { label: "Petrol", value: distribution.petrol, color: "#3b82f6", hoverColor: "#60a5fa" },
    { label: "Diesel", value: distribution.diesel, color: "#f59e0b", hoverColor: "#fbbf24" },
    { label: "Lubricant", value: distribution.lubricant, color: "#10b981", hoverColor: "#34d399" },
  ];

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  // Animate on mount
  useEffect(() => {
    const timer = setTimeout(() => setAnimationProgress(1), 100);
    return () => clearTimeout(timer);
  }, []);

  let offset = 0;

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 p-5 h-full">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink">Fuel Distribution</h3>
        <p className="text-xs text-ink-subtle mt-0.5">Vouchers by fuel type</p>
      </div>

      {total === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink-subtle">
          No voucher data yet.
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {/* Donut Chart */}
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
              {segments.map((seg) => {
                if (seg.value === 0) return null;
                const frac = seg.value / total;
                const dash = frac * CIRC * animationProgress;
                const el = (
                  <circle
                    key={seg.label}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRC - dash}`}
                    strokeDashoffset={-offset * animationProgress}
                    strokeLinecap="butt"
                    className="transition-all duration-700 ease-out"
                    style={{ filter: `drop-shadow(0 0 4px ${seg.color}40)` }}
                  />
                );
                offset += frac * CIRC;
                return el;
              })}
            </svg>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-ink">
                {total}
              </span>
              <span className="text-[10px] font-mono text-ink-subtle uppercase tracking-wider">
                vouchers
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="w-full space-y-2.5">
            {segments.map((seg) => {
              const percent = total
                ? Math.round((seg.value / total) * 100)
                : 0;
              return (
                <div
                  key={seg.label}
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full transition-shadow duration-200"
                      style={{
                        background: seg.color,
                        boxShadow: `0 0 6px ${seg.color}40`,
                      }}
                    />
                    <span className="text-sm font-medium text-ink-muted group-hover:text-ink transition">
                      {seg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {seg.value}
                    </span>
                    <span className="text-xs text-ink-subtle rounded-md bg-surface-3 px-1.5 py-0.5 font-mono">
                      {percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
