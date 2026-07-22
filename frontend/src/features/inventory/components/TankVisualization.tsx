import type { FuelType } from "../types";

interface Props {
  fuelType: FuelType;
  capacityLiters: number;
  currentStockLiters: number;
  daysUntilEmpty: number | null;
}

export default function TankVisualization({
  fuelType,
  capacityLiters,
  currentStockLiters,
  daysUntilEmpty,
}: Props) {
  // Calculate stock percentage, capped between 0 and 100
  const rawPct = capacityLiters > 0 ? (currentStockLiters / capacityLiters) * 100 : 0;
  const pct = Math.min(100, Math.max(0, rawPct));
  const ullage = Math.max(0, capacityLiters - currentStockLiters);

  // Modern HSL color mapping for fuel types
  // Petrol (Blue/Teal), Diesel (Gold/Amber), Speed (Purple/Violet), Lubricant (Emerald/Green)
  const getFuelColors = (type: FuelType) => {
    switch (type) {
      case "PETROL":
        return {
          fill: "url(#petrolGrad)",
          stroke: "#3b82f6",
          light: "#3b82f620",
        };
      case "SPEED":
        return {
          fill: "url(#speedGrad)",
          stroke: "#8b5cf6",
          light: "#8b5cf620",
        };
      case "DIESEL":
        return {
          fill: "url(#dieselGrad)",
          stroke: "#d97706",
          light: "#d9770620",
        };
      case "LUBRICANT":
        return {
          fill: "url(#lubricantGrad)",
          stroke: "#10b981",
          light: "#10b98120",
        };
      default:
        return {
          fill: "#a1a1aa",
          stroke: "#71717a",
          light: "#71717a20",
        };
    }
  };

  const colors = getFuelColors(fuelType);
  const isLowStock = pct < 15 || (daysUntilEmpty !== null && daysUntilEmpty <= 3);

  // SVG coordinates: Horizontal capsule tank
  // Tank capsule width 180, height 70
  const width = 200;
  const height = 80;
  const rx = 24; // capsule rounding
  const strokeWidth = 2;

  // Liquid height inside the tank
  // We fill from the bottom (y = height - margin) up to y = margin
  const marginY = 8;
  const usableHeight = height - marginY * 2;
  const liquidHeight = (pct / 100) * usableHeight;
  const liquidY = height - marginY - liquidHeight;

  return (
    <div
      className="relative flex flex-col items-center justify-center p-2 rounded-xl bg-surface-2/40 border border-hairline/40 transition-all duration-300"
    >
      <svg
        width="100%"
        height="85"
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="petrolGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="dieselGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="lubricantGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0.95" />
          </linearGradient>

          {/* Tank mask to clip the liquid level correctly inside the capsule */}
          <clipPath id="tankClip">
            <rect
              x={strokeWidth}
              y={strokeWidth}
              width={width - strokeWidth * 2}
              height={height - strokeWidth * 2}
              rx={rx}
              ry={rx}
            />
          </clipPath>
        </defs>

        {/* Tank outer casing / shadow */}
        <rect
          x={1}
          y={1}
          width={width - 2}
          height={height - 2}
          rx={rx}
          ry={rx}
          fill="#18181b"
          stroke={isLowStock ? "#ef4444" : colors.stroke}
          strokeWidth={strokeWidth}
          className="transition-colors duration-300"
          style={{
            filter: `drop-shadow(0 0 6px ${isLowStock ? "#ef444430" : colors.stroke + "20"})`,
          }}
        />

        {/* Dry space / Ullage Grid (diagonal stripes/dots inside the tank body) */}
        <g clipPath="url(#tankClip)">
          {/* Subtle grid mesh */}
          <path
            d={`M 0 20 L ${width} 20 M 0 40 L ${width} 40 M 0 60 L ${width} 60`}
            stroke="#27272a"
            strokeWidth="0.75"
            strokeDasharray="3 3"
          />
          <path
            d={`M 50 0 L 50 ${height} M 100 0 L 100 ${height} M 150 0 L 150 ${height}`}
            stroke="#27272a"
            strokeWidth="0.75"
            strokeDasharray="3 3"
          />

          {/* Fuel Liquid level filled from bottom */}
          {pct > 0 && (
            <rect
              x={strokeWidth}
              y={liquidY}
              width={width - strokeWidth * 2}
              height={liquidHeight + marginY}
              fill={colors.fill}
              className="transition-all duration-700 ease-out-back"
            />
          )}

          {/* Grid labels / markers inside the tank (25%, 50%, 75%) */}
          <line x1="12" y1="20" x2="24" y2="20" stroke="#71717a" strokeWidth="0.7" />
          <text x="28" y="23" fill="#71717a" fontSize="7" fontFamily="monospace">75%</text>

          <line x1="12" y1="40" x2="24" y2="40" stroke="#71717a" strokeWidth="0.7" />
          <text x="28" y="43" fill="#71717a" fontSize="7" fontFamily="monospace">50%</text>

          <line x1="12" y1="60" x2="24" y2="60" stroke="#71717a" strokeWidth="0.7" />
          <text x="28" y="63" fill="#71717a" fontSize="7" fontFamily="monospace">25%</text>
        </g>

        {/* Wet Line Indicator (the water level marker on top of the fuel) */}
        {pct > 0 && pct < 100 && (
          <line
            x1={strokeWidth}
            y1={liquidY}
            x2={width - strokeWidth}
            y2={liquidY}
            stroke="#ffffff"
            strokeWidth="1.25"
            strokeDasharray="4 2"
            opacity="0.8"
            className="transition-all duration-700 ease-out-back"
          />
        )}
      </svg>

      {/* Dynamic details overlay on hover */}
      <div className="w-full mt-2 flex justify-between items-center text-[10px] font-mono px-1">
        <div className="flex flex-col">
          <span className="text-ink-subtle uppercase text-[8px] tracking-wider">Ullage (Dry Space)</span>
          <span className="font-bold text-ink">
            {ullage.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-ink-subtle uppercase text-[8px] tracking-wider">Fill Percentage</span>
          <span
            className={`font-black ${
              isLowStock ? "text-red-500 font-extrabold animate-pulse" : "text-ink"
            }`}
          >
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
