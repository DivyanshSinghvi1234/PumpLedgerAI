import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, Landmark, Save, TrendingUp } from "lucide-react";

import LoadingState from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import settingService from "@/features/settings/services/settingService";

const BankAccountsPage = lazy(() => import("@/features/admin/BankAccountsPage"));
const ProfitLossSection = lazy(() => import("@/features/reports/components/ProfitLossSection"));
const ReportsPage = lazy(() => import("@/features/reports/ReportsPage"));

type MoneyTab = "bank" | "profit" | "reports";

const FUEL_TYPES = ["PETROL", "DIESEL", "SPEED", "CNG", "EV"] as const;

const TABS: { key: MoneyTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "bank", label: "Cash & Bank Balances", icon: Landmark },
  { key: "profit", label: "Commission & Profit", icon: TrendingUp },
  { key: "reports", label: "All Reports", icon: BarChart3 },
];

export default function MoneyProfitHubPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: MoneyTab =
    rawTab === "profit" || rawTab === "reports" ? rawTab : "bank";

  const setTab = (tab: MoneyTab) => {
    setSearchParams(tab === "bank" ? {} : { tab }, { replace: true });
  };

  const [rates, setRates] = useState<Record<string, string>>({
    PETROL: "3.50",
    DIESEL: "2.20",
    SPEED: "4.00",
    CNG: "0",
    EV: "0",
  });

  const { data: savedCommission } = useQuery({
    queryKey: ["setting", "fuel_commission_rates"],
    queryFn: () => settingService.getSetting<Record<string, number>>("fuel_commission_rates"),
  });

  useEffect(() => {
    if (!savedCommission) return;
    setRates((prev) => {
      const next = { ...prev };
      for (const ft of FUEL_TYPES) {
        if (savedCommission[ft] !== undefined) {
          next[ft] = String(savedCommission[ft]);
        }
      }
      return next;
    });
  }, [savedCommission]);

  const saveCommissionMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, number> = {};
      for (const ft of FUEL_TYPES) {
        const num = Number(rates[ft]);
        if (!Number.isNaN(num) && num >= 0) {
          payload[ft] = num;
        }
      }
      return settingService.saveSetting("fuel_commission_rates", payload);
    },
    onSuccess: () => {
      toast.success("Fuel commission rates saved — P&L & Daily Register profit updated!");
      queryClient.invalidateQueries({ queryKey: ["setting", "fuel_commission_rates"] });
      queryClient.invalidateQueries({ queryKey: ["report-pnl"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not save commission rates");
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Money &amp; Profit</h1>
        <p className="text-xs text-ink-muted mt-0.5">
          Live Cash-in-Hand, Bank balances, and Fuel Commission Profit minus expenses.
        </p>
      </div>

      <div data-tour="money-tabs" className="flex border-b border-hairline gap-3 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 pb-3 px-2 text-sm border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? "border-fuel-amber text-ink font-bold"
                  : "border-transparent text-ink-muted hover:text-ink font-medium"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div data-tour="money-content">
        <Suspense fallback={<LoadingState />}>
        {activeTab === "bank" && <BankAccountsPage />}

        {activeTab === "profit" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-ink">
                    Dealer Commission per Liter (₹ / L)
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Used to calculate daily &amp; monthly profit automatically from fuel sold (even if tanker purchase invoices aren&apos;t entered).
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => saveCommissionMutation.mutate()}
                  disabled={saveCommissionMutation.isPending}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saveCommissionMutation.isPending ? "Saving..." : "Save Commission"}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {FUEL_TYPES.map((ft) => (
                  <div key={ft} className="space-y-1">
                    <Label className="text-xs text-ink-muted">{ft} (₹/L)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rates[ft] ?? "0"}
                      onChange={(e) =>
                        setRates((prev) => ({ ...prev, [ft]: e.target.value }))
                      }
                      className="h-9 font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <ProfitLossSection />
          </div>
        )}

        {activeTab === "reports" && <ReportsPage />}
        </Suspense>
      </div>
    </div>
  );
}
