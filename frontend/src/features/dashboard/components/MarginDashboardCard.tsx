import { useState } from "react";
import { useMargins } from "../hooks/useDashboard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LineChart, AlertTriangle } from "lucide-react";

export default function MarginDashboardCard() {
  const { data, isLoading, isError, refetch } = useMargins();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <Card className="glass border-hairline h-[280px] flex items-center justify-center">
        <span className="text-xs text-ink-subtle">Loading profit margins...</span>
      </Card>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <Card className="glass border-hairline h-[280px] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="flex items-center gap-2 text-fuel-amber">
          <AlertTriangle size={16} />
          <p className="text-xs font-semibold">Couldn't load profit margins.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs px-3 py-1.5 rounded cursor-pointer"
        >
          Retry
        </button>
      </Card>
    );
  }

  // Define keys for fuel types
  const fuelTypes: Array<"PETROL" | "DIESEL" | "SPEED" | "LUBRICANT"> = [
    "PETROL",
    "DIESEL",
    "SPEED",
    "LUBRICANT",
  ];

  const fuelColors = {
    PETROL: "#3b82f6",
    DIESEL: "#f59e0b",
    SPEED: "#8b5cf6",
    LUBRICANT: "#10b981",
  };

  // Find dynamic range for Y scale
  const allValues: number[] = [];
  data.forEach((d) => {
    fuelTypes.forEach((f) => {
      const v = d[f];
      if (v !== null && v !== undefined) {
        allValues.push(v);
      }
    });
  });

  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 10;

  // Add 15% margin on top and bottom
  const minMargin = minVal < 0 ? minVal * 1.15 : 0;
  const maxMargin = maxVal > 0 ? maxVal * 1.15 : 10;
  const range = maxMargin - minMargin || 1;

  // SVG Chart settings
  const width = 600;
  const height = 180;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 15;
  const paddingBottom = 25;

  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;

  // Helper to map index & value to SVG coords
  const getX = (index: number) => {
    return paddingLeft + (index / (data.length - 1)) * usableWidth;
  };

  const getY = (val: number | null | undefined) => {
    if (val === null || val === undefined) return paddingTop + usableHeight; // bottom
    const pct = (val - minMargin) / range;
    return paddingTop + usableHeight - pct * usableHeight;
  };

  // Generate paths for each line
  const lines = fuelTypes.map((fuel) => {
    const points: string[] = [];
    data.forEach((d, index) => {
      const val = d[fuel];
      if (val !== null && val !== undefined) {
        points.push(`${getX(index)},${getY(val)}`);
      }
    });
    return {
      fuel,
      path: points.length > 0 ? `M ${points.join(" L ")}` : "",
      color: fuelColors[fuel],
    };
  });

  // Handle SVG Mouse Events
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - svgRect.left;

    // Relative X coordinate inside the graph area
    const relativeX = x - paddingLeft;
    const ratio = relativeX / usableWidth;
    const index = Math.min(
      data.length - 1,
      Math.max(0, Math.round(ratio * (data.length - 1)))
    );

    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Format date for visual presentation
  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const hoveredData = hoveredIndex !== null ? data[hoveredIndex] : null;

  return (
    <Card className="glass border-hairline overflow-hidden flex flex-col justify-between">
      <CardHeader className="pb-2 border-b border-hairline/40 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold text-ink flex items-center gap-1.5">
            <LineChart size={15} className="text-fuel-amber" /> Profit Margins per Liter
          </CardTitle>
          <CardDescription className="text-[11px] text-ink-subtle">
            Daily profit margin trend over the last 30 days (Price Schedule Rate - Procurement Cost)
          </CardDescription>
        </div>
        <div className="flex gap-3 text-[10px] font-mono no-print">
          {fuelTypes.map((f) => (
            <div key={f} className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: fuelColors[f] }}
              />
              <span className="text-ink-muted capitalize">{f.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-5 grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
        {/* The SVG Line Graph */}
        <div className="lg:col-span-3 relative h-[180px] w-full">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
              const y = paddingTop + usableHeight * p;
              const val = maxMargin - p * range;
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="#27272a"
                    strokeWidth="0.5"
                    strokeDasharray="2 3"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    fill="#71717a"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    ₹{(val ?? 0).toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Date Labels (x-axis) */}
            {[0, 9, 19, 29].map((idx) => {
              if (idx >= data.length) return null;
              const x = getX(idx);
              const d = data[idx];
              return (
                <g key={idx}>
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + usableHeight}
                    stroke="#27272a"
                    strokeWidth="0.5"
                    strokeDasharray="1 4"
                  />
                  <text
                    x={x}
                    y={height - 8}
                    fill="#71717a"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {formatDate(d.date)}
                  </text>
                </g>
              );
            })}

            {/* Main Trend Lines */}
            {lines.map((l) => (
              <path
                key={l.fuel}
                d={l.path}
                fill="none"
                stroke={l.color}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
                style={{
                  filter: `drop-shadow(0 0 4px ${l.color}25)`,
                }}
              />
            ))}

            {/* Hover vertical tracer and dot highlights */}
            {hoveredIndex !== null && hoveredData && (
              <>
                {/* Vertical helper line */}
                <line
                  x1={getX(hoveredIndex)}
                  y1={paddingTop}
                  x2={getX(hoveredIndex)}
                  y2={paddingTop + usableHeight}
                  stroke="#52525b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />

                {/* Markers per fuel type */}
                {fuelTypes.map((fuel) => {
                  const val = hoveredData[fuel];
                  if (val === null || val === undefined) return null;
                  return (
                    <circle
                      key={fuel}
                      cx={getX(hoveredIndex)}
                      cy={getY(val)}
                      r="4"
                      fill={fuelColors[fuel]}
                      stroke="#18181b"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </>
            )}
          </svg>
        </div>

        {/* Hover info / current stats panel */}
        <div className="lg:col-span-1 rounded-xl bg-surface-2 p-3.5 border border-hairline/40 h-full flex flex-col justify-center">
          {hoveredData ? (
            <div className="space-y-2.5">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-ink-subtle uppercase tracking-wider">Selected Date</span>
                <span className="text-xs font-black text-ink">{formatDate(hoveredData.date)}</span>
              </div>
              <div className="space-y-1.5 border-t border-hairline/40 pt-2">
                {fuelTypes.map((f) => {
                  const margin = hoveredData[f];
                  return (
                    <div key={f} className="flex justify-between items-center text-xs font-mono">
                      <span className="text-ink-muted capitalize">{f.toLowerCase()}:</span>
                      <span
                        className="font-bold"
                        style={{ color: margin != null && !isNaN(margin) ? fuelColors[f] : "#71717a" }}
                      >
                        {margin != null && !isNaN(margin) ? `₹${Number(margin).toFixed(2)}/L` : "No cost logged"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-1">
              <span className="text-xl">📊</span>
              <p className="text-[10px] text-ink-subtle leading-relaxed">
                Hover over the chart to inspect daily profit margins per liter.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
