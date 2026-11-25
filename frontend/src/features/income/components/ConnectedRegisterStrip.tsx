import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Fuel, Landmark, Wallet, Receipt } from "lucide-react";
import { Link } from "react-router-dom";

import api from "@/api/client";
import bankAccountService from "@/features/admin/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";

interface ConnectedRegisterStripProps {
  apiDate: string;
}

export default function ConnectedRegisterStrip({ apiDate }: ConnectedRegisterStripProps) {
  const { data: closingDraft } = useQuery({
    queryKey: ["day-closing-draft", apiDate],
    queryFn: async () => {
      const res = await api.get<{
        already_closed: boolean;
        gross_meter_sales: number;
        total_voucher_sales: number;
        tank_dips: Array<{ tank_name: string; variance_liters: number | null; status: string }>;
      }>("/v1/day-closings/draft", { params: { closing_date: apiDate } });
      return res.data;
    },
  });

  const { data: funds } = useQuery({
    queryKey: ["bank-accounts-summary"],
    queryFn: () => bankAccountService.getLiquidFundsSummary(),
  });

  if (!closingDraft && !funds) return null;

  const meterSales = Number(closingDraft?.gross_meter_sales ?? 0);
  const voucherSales = Number(closingDraft?.total_voucher_sales ?? 0);
  const meterGap = Math.abs(meterSales - voucherSales);
  const hasStockAlert = (closingDraft?.tank_dips ?? []).some(
    (t) => t.status === "WARNING" || t.status === "CRITICAL"
  );

  return (
    <div className="rounded-2xl border border-hairline bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          Connected Register Health ({apiDate})
        </p>
        <div className="flex items-center gap-3 text-xs">
          {closingDraft?.already_closed ? (
            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Day Locked & Synced
            </span>
          ) : (
            <Link to="/dashboard/day-closing" className="text-fuel-amber font-semibold hover:underline">
              Open Day Closing →
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl border border-hairline bg-surface-2 p-3">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Meter vs Vouchers</span>
            <Receipt className="h-3.5 w-3.5 text-fuel-amber" />
          </div>
          <div className="mt-1 font-mono font-bold text-ink">
            {formatCurrency(meterSales)} / {formatCurrency(voucherSales)}
          </div>
          <div className={`mt-0.5 text-[11px] ${meterGap > 500 ? "text-amber-500 font-semibold" : "text-emerald-500"}`}>
            {meterGap > 500 ? `Gap: ${formatCurrency(meterGap)}` : "Matched"}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-3">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Tank Stock Variance</span>
            <Fuel className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="mt-1 font-semibold text-ink">
            {(closingDraft?.tank_dips ?? []).length} Tank(s) Tracked
          </div>
          <div className={`mt-0.5 text-[11px] inline-flex items-center gap-1 ${hasStockAlert ? "text-rose-500 font-semibold" : "text-emerald-500"}`}>
            {hasStockAlert ? (
              <>
                <AlertTriangle className="h-3 w-3" /> Check Dip Variance
              </>
            ) : (
              "Within Tolerance"
            )}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-3">
          <div className="flex items-center justify-between text-ink-muted">
            <span>Forecourt Cash</span>
            <Wallet className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="mt-1 font-mono font-bold text-ink">
            {formatCurrency(funds?.total_cash_available ?? 0)}
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted">Live drawer + withdrawals</div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-3">
          <div className="flex items-center justify-between text-ink-muted">
            <span>All Bank Accounts</span>
            <Landmark className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="mt-1 font-mono font-bold text-ink">
            {formatCurrency(funds?.total_bank_balance ?? 0)}
          </div>
          <Link to="/dashboard/bank-accounts" className="mt-0.5 inline-block text-[11px] text-blue-500 hover:underline">
            {(funds?.accounts ?? []).length} account(s) · Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}
