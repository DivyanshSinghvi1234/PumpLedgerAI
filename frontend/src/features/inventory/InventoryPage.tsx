import { useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import DispenserTab from "./components/DispenserTab";
import MeterReadingsTab from "./components/MeterReadingsTab";
import MeterLogsTab from "./components/MeterLogsTab";
import PriceSchedulesTab from "./components/PriceSchedulesTab";
import StockReconciliationTab from "./components/StockReconciliationTab";
import LubricantsTab from "./components/LubricantsTab";
import PurchaseIndentsTab from "./components/PurchaseIndentsTab";

export default function InventoryPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const [activeTab, setActiveTab] = useState<"dips" | "indents" | "readings" | "prices" | "dispensers" | "history" | "lubricants">("dips");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Inventory & Pricing"
          description="Configure storage tanks, bulk meter entries, packaged lubricants & DEF, OMC purchase indents, fuel rates, and dispensers."
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
          onClick={() => setActiveTab("indents")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "indents"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          OMC Indents & TTs
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
          onClick={() => setActiveTab("lubricants")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "lubricants"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Lube & DEF Stock
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

      {activeTab === "indents" && (
        <PurchaseIndentsTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "readings" && (
        <MeterReadingsTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "lubricants" && (
        <LubricantsTab isAdminOrManager={isAdminOrManager} />
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

