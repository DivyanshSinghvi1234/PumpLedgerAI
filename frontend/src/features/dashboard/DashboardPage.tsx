import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useDashboard } from "./hooks/useDashboard";

import StatCards from "./components/StatCards";
import FuelDistributionCard from "./components/FuelDistributionCard";
import RecentVouchers from "./components/RecentVouchers";

export default function DashboardPage() {
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
    </div>
  );
}
