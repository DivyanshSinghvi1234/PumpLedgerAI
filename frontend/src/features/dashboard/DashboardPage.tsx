import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronDown, ChevronUp, Zap, Upload, FileText, Wallet, AlertCircle } from "lucide-react";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useDashboard } from "./hooks/useDashboard";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useLanguage } from "@/i18n/LanguageContext";
import { pipelineService } from "@/features/pipeline/services/pipelineService";
import { FivePointAuditBanner } from "@/features/pipeline/components/FivePointAuditBanner";
import { getTodayDateString } from "@/lib/utils";

import StatCards from "./components/StatCards";
import DailyRoutineGuide from "./components/DailyRoutineGuide";
import FuelDistributionCard from "./components/FuelDistributionCard";
import RecentVouchers from "./components/RecentVouchers";
import DebtorAgingCard from "./components/DebtorAgingCard";
import MarginDashboardCard from "./components/MarginDashboardCard";
import CustomerAnalyticsCard from "./components/CustomerAnalyticsCard";
import NPSDashboardCard from "./components/NPSDashboardCard";
import StockVarianceCard from "./components/StockVarianceCard";

const ANALYTICS_OPEN_KEY = "pumpledger_show_detailed_analytics";

export default function DashboardPage() {
  const { user, hasRole } = useCurrentUser();
  const { t } = useLanguage();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");
  const isOperator = user?.role === "OPERATOR";
  const todayStr = getTodayDateString();

  const { data: snapshot } = useQuery({
    queryKey: ["daily-snapshot", todayStr],
    queryFn: () => pipelineService.getSnapshot(todayStr),
    enabled: isAdminOrManager,
  });

  const isPayrollDueWindow = (() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate() <= 2;
  })();

  const [showAnalytics, setShowAnalytics] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ANALYTICS_OPEN_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleAnalytics = () => {
    const next = !showAnalytics;
    setShowAnalytics(next);
    try {
      localStorage.setItem(ANALYTICS_OPEN_KEY, String(next));
    } catch {
      // ignore storage errors
    }
  };

  const {
    data,
    isLoading,
    isError,
  } = useDashboard();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    return (
      <EmptyState message="Unable to load dashboard." />
    );
  }

  // Get current date/time for the greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-xl border border-hairline bg-gradient-to-r from-surface-1 to-surface-2 p-5">
        <h1 className="text-lg font-bold tracking-tight text-ink">
          {t(greeting)} 👋
        </h1>
        <p className="text-sm text-ink-muted mt-0.5">
          {t("Here's an overview of your pump activity today.")}
        </p>
      </div>

      {/* Role-Tailored Cashier Simple Mode */}
      {isOperator && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/dashboard/quick-entry" className="rounded-xl border border-fuel-amber/40 bg-fuel-amber/10 p-4 flex items-center gap-3 hover:bg-fuel-amber/20 transition">
            <Zap className="h-6 w-6 text-fuel-amber" />
            <div>
              <div className="font-bold text-sm text-ink">Quick Entry</div>
              <div className="text-xs text-ink-muted">Fast forecourt credit / cash / UPI slip</div>
            </div>
          </Link>
          <Link to="/dashboard/upload" className="rounded-xl border border-hairline bg-surface-1 p-4 flex items-center gap-3 hover:bg-surface-2 transition">
            <Upload className="h-6 w-6 text-indigo-400" />
            <div>
              <div className="font-bold text-sm text-ink">Upload Bill</div>
              <div className="text-xs text-ink-muted">Snap &amp; scan handwritten slip</div>
            </div>
          </Link>
          <Link to="/dashboard/vouchers" className="rounded-xl border border-hairline bg-surface-1 p-4 flex items-center gap-3 hover:bg-surface-2 transition">
            <FileText className="h-6 w-6 text-emerald-400" />
            <div>
              <div className="font-bold text-sm text-ink">Today&apos;s Slips</div>
              <div className="text-xs text-ink-muted">View all entries recorded today</div>
            </div>
          </Link>
        </div>
      )}

      {/* Owner/Manager Pending Today Strip, Payroll Alert & 5-Point Auto-Audit */}
      {isAdminOrManager && (
        <div className="space-y-3">
          {snapshot && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface-1 px-4 py-2.5 text-xs">
              <span className="font-bold text-ink flex items-center gap-1.5 mr-1">
                <AlertCircle size={14} className="text-fuel-amber" /> Pending Today:
              </span>
              {snapshot.meters.missing_nozzles.length > 0 && (
                <Link to="/dashboard/inventory" className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2.5 py-0.5 font-semibold hover:underline">
                  {snapshot.meters.missing_nozzles.length} nozzle(s) missing closing
                </Link>
              )}
              {!snapshot.is_locked && (
                <Link to="/dashboard/day-closing" className="rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 px-2.5 py-0.5 font-semibold hover:underline">
                  Day Closing Open
                </Link>
              )}
              {snapshot.vouchers.unbilled_cash_fuel > 1 && (
                <Link to="/dashboard/day-closing" className="rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 px-2.5 py-0.5 font-semibold hover:underline">
                  ₹{snapshot.vouchers.unbilled_cash_fuel.toLocaleString("en-IN")} unbilled cash
                </Link>
              )}
              {isPayrollDueWindow && (
                <Link to="/dashboard/staff" className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 px-2.5 py-0.5 font-semibold hover:underline inline-flex items-center gap-1">
                  <Wallet size={11} /> Payroll Due — Pay Salaries (Cash / Bank)
                </Link>
              )}
            </div>
          )}
          <FivePointAuditBanner targetDate={todayStr} />
        </div>
      )}

      <DailyRoutineGuide />

      <StatCards summary={data.summary} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <FuelDistributionCard
            distribution={data.fuel_distribution}
          />
        </div>

        <div className="lg:col-span-2">
          <RecentVouchers
            vouchers={data.recent_vouchers}
          />
        </div>
      </div>

      {/* Collapsible Detailed Analytics */}
      <div className="rounded-xl border border-hairline bg-surface-1/50 p-4">
        <button
          type="button"
          onClick={toggleAnalytics}
          className="flex w-full items-center justify-between text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-fuel-amber" />
            <span className="text-sm font-bold text-ink">Detailed Analytics & Insights</span>
            <span className="hidden sm:inline text-xs text-ink-subtle">
              — Stock variance, debtor aging, margins & customer NPS
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
            {showAnalytics ? (
              <>
                Hide <ChevronUp size={14} />
              </>
            ) : (
              <>
                Show <ChevronDown size={14} />
              </>
            )}
          </span>
        </button>

        {showAnalytics && (
          <div className="mt-4 space-y-6">
            <StockVarianceCard />
            <DebtorAgingCard />
            <MarginDashboardCard />
            <CustomerAnalyticsCard />
            <NPSDashboardCard />
          </div>
        )}
      </div>
    </div>
  );
}
