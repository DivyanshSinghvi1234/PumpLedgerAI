import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useDashboard } from "./hooks/useDashboard";

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
          {greeting} 👋
        </h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Here's an overview of your pump activity today.
        </p>
      </div>

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
