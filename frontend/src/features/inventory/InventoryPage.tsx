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

  const [activeTab, setActiveTab] = useState<"dispensers" | "readings" | "history" | "prices" | "dips">("dispensers");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Inventory & Pricing"
          description="Configure dispensers, perform bulk meter entries, and manage scheduled fuel rate structures."
        />
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-hairline gap-4">
        <button
          onClick={() => setActiveTab("dispensers")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "dispensers"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Fuel Dispensers
        </button>
        <button
          onClick={() => setActiveTab("readings")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "readings"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Meter Readings
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "history"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Meter Logs
        </button>

        <button
          onClick={() => setActiveTab("prices")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "prices"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Price Schedules
        </button>

        <button
          onClick={() => setActiveTab("dips")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "dips"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Stock Reconciliation
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "dispensers" && (
        <DispenserTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "readings" && (
        <MeterReadingsTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "history" && (
        <MeterLogsTab />
      )}

      {activeTab === "prices" && (
        <PriceSchedulesTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "dips" && (
        <StockReconciliationTab isAdminOrManager={isAdminOrManager} />
      )}
    </div>
  );
}
