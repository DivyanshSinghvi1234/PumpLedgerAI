import { useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import DispenserTab from "./components/DispenserTab";
import MeterReadingsTab from "./components/MeterReadingsTab";
import MeterLogsTab from "./components/MeterLogsTab";
import PriceSchedulesTab from "./components/PriceSchedulesTab";
import StockReconciliationTab from "./components/StockReconciliationTab";

export default function InventoryPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const [activeTab, setActiveTab] = useState<"dips" | "readings" | "prices" | "dispensers" | "history">("dips");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Inventory & Pricing"
          description="Configure storage tanks, bulk meter entries, scheduled fuel rates, dispensers, and logs."
        />
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-hairline gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab("dips")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "dips"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Fuel Storage
        </button>
        <button
          onClick={() => setActiveTab("readings")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "readings"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Meter Readings
        </button>
        <button
          onClick={() => setActiveTab("prices")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "prices"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Price Schedules
        </button>
        <button
          onClick={() => setActiveTab("dispensers")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "dispensers"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Fuel Dispensers
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "history"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Meter Logs
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "dips" && (
        <StockReconciliationTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "readings" && (
        <MeterReadingsTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "prices" && (
        <PriceSchedulesTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "dispensers" && (
        <DispenserTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "history" && (
        <MeterLogsTab />
      )}
    </div>
  );
}
