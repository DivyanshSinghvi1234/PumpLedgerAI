import { useState } from "react";
import { Fuel, Truck, Gauge, Package, Tag, Wrench, History } from "lucide-react";
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
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "dips"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Fuel className="h-4 w-4 shrink-0" />
          Fuel Storage
        </button>
        <button
          onClick={() => setActiveTab("indents")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "indents"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Truck className="h-4 w-4 shrink-0" />
          OMC Indents & TTs
        </button>
        <button
          onClick={() => setActiveTab("readings")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "readings"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Gauge className="h-4 w-4 shrink-0" />
          Meter Readings
        </button>
        <button
          onClick={() => setActiveTab("lubricants")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "lubricants"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Package className="h-4 w-4 shrink-0" />
          Lube & DEF Stock
        </button>
        <button
          onClick={() => setActiveTab("prices")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "prices"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Tag className="h-4 w-4 shrink-0" />
          Price Schedules
        </button>
        <button
          onClick={() => setActiveTab("dispensers")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "dispensers"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <Wrench className="h-4 w-4 shrink-0" />
          Fuel Dispensers
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "history"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          <History className="h-4 w-4 shrink-0" />
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

