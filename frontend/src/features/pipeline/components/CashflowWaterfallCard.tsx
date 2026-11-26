import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TrendingUp, Droplets, Wallet, CreditCard } from "lucide-react";
import { pipelineService } from "../services/pipelineService";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CashflowWaterfallCard() {
  const today = getTodayDateString();
  const [simulateTankerCost, setSimulateTankerCost] = useState(0);

  const { data: snap } = useQuery({
    queryKey: ["daily-snapshot", today],
    queryFn: () => pipelineService.getSnapshot(today),
  });

  if (!snap) return null;

  const gross = snap.meters.gross_meter_sales || snap.vouchers.total_voucher_sales;
  const cashIn = snap.cash_proof.cash_fuel_sales + snap.cash_proof.cash_payments_received;
  const digitalIn = snap.digital_collections.total_digital;
  const creditOut = snap.vouchers.credit_sales;
  const expenses = snap.cash_proof.cash_expenses;
  const totalBank = snap.bank_reconciliation.reduce((s, b) => s + b.closing_balance, 0);
  const liquidTotal = snap.cash_proof.expected_drawer_cash + totalBank;
  const projectedLiquid = liquidTotal - simulateTankerCost;

  const bars = [
    { label: "Gross Fuel Sales", val: gross, color: "bg-fuel-amber", to: "/dashboard/vouchers" },
    { label: "Cash Collected", val: cashIn, color: "bg-emerald-500", to: "/dashboard/register" },
    { label: "UPI / Card / Bank", val: digitalIn, color: "bg-indigo-500", to: "/dashboard/bank-accounts" },
    { label: "Credit Issued", val: creditOut, color: "bg-amber-500", to: "/dashboard/customers" },
    { label: "Cash Expenses", val: expenses, color: "bg-rose-500", to: "/dashboard/income" },
  ];
  const maxVal = Math.max(1, ...bars.map((b) => b.val));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Where Every Rupee Went &amp; Cashflow What-If
          </span>
          <span className="text-xs font-mono text-ink-muted">{today}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        <div className="space-y-2">
          {bars.map((b) => (
            <Link key={b.label} to={b.to} className="block group">
              <div className="flex justify-between mb-0.5">
                <span className="font-medium text-ink group-hover:text-fuel-amber">{b.label}</span>
                <span className="font-mono font-bold text-ink">{formatCurrency(b.val)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${b.color} transition-all duration-500`}
                  style={{ width: `${Math.min(100, Math.round((b.val / maxVal) * 100))}%` }}
                />
              </div>
            </Link>
          ))}
        </div>

        {/* Working Capital & Tanker What-If Simulator */}
        <div className="rounded-xl border border-hairline bg-surface-2 p-3 space-y-2.5">
          <div className="flex items-center justify-between font-bold text-ink">
            <span className="flex items-center gap-1.5">
              <Wallet size={13} className="text-emerald-500" /> Liquid Funds (Cash + Banks)
            </span>
            <span className="font-mono text-emerald-500">{formatCurrency(liquidTotal)}</span>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-ink-muted mb-1">
              <span className="flex items-center gap-1"><Droplets size={11} /> Simulate Tanker Order (RTGS)</span>
              <span className="font-mono">{formatCurrency(simulateTankerCost)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2000000}
              step={100000}
              value={simulateTankerCost}
              onChange={(e) => setSimulateTankerCost(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between border-t border-hairline pt-2 font-mono font-bold">
            <span className="flex items-center gap-1 text-ink-muted">
              <CreditCard size={12} /> Projected Balance After Tanker:
            </span>
            <span className={projectedLiquid >= 0 ? "text-emerald-500" : "text-rose-500"}>
              {formatCurrency(projectedLiquid)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
