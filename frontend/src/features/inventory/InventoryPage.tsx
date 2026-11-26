import { useState } from "react";
import { Fuel, Package, Tag, Truck } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import DispenserTab from "./components/DispenserTab";
import PriceSchedulesTab from "./components/PriceSchedulesTab";
import StockReconciliationTab from "./components/StockReconciliationTab";
import { TankMarginAnalyticsCard } from "./components/TankMarginAnalyticsCard";
import LubricantsTab from "./components/LubricantsTab";
import PurchaseIndentsTab from "./components/PurchaseIndentsTab";

type InventoryTab = "tanks" | "deliveries" | "setup";

export default function InventoryPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const [activeTab, setActiveTab] = useState<InventoryTab>("tanks");
  const [showLubricants, setShowLubricants] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage underground fuel tanks, tanker deliveries, selling prices, and pump nozzles. Daily meter entry lives on the Daily Register."
      />

      {/* 3 Clear Tabs */}
      <div className="flex border-b border-hairline gap-4 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("tanks")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "tanks"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink font-medium"
          }`}
        >
          <Fuel className="h-4 w-4 shrink-0" />
          Tanks &amp; Stock
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("deliveries")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "deliveries"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink font-medium"
          }`}
        >
          <Truck className="h-4 w-4 shrink-0" />
          Tanker Deliveries
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("setup")}
          className={`inline-flex items-center gap-1.5 pb-3 text-sm tracking-wide border-b-2 transition-all px-2 cursor-pointer whitespace-nowrap ${
            activeTab === "setup"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink font-medium"
          }`}
        >
          <Tag className="h-4 w-4 shrink-0" />
          Prices &amp; Nozzles
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "tanks" && (
        <div className="space-y-6">
          <StockReconciliationTab isAdminOrManager={isAdminOrManager} />
          {isAdminOrManager && <TankMarginAnalyticsCard />}

          <div className="rounded-xl border border-hairline bg-surface-1 p-4">
            <button
              type="button"
              onClick={() => setShowLubricants((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer"
            >
              <Package className="h-4 w-4 text-fuel-amber" />
              {showLubricants ? "Hide Packaged Lube & DEF Stock" : "Show Packaged Lube & DEF Stock"}
            </button>
            {showLubricants && (
              <div className="mt-4">
                <LubricantsTab isAdminOrManager={isAdminOrManager} />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "deliveries" && (
        <PurchaseIndentsTab isAdminOrManager={isAdminOrManager} />
      )}

      {activeTab === "setup" && (
        <div className="space-y-8">
          <PriceSchedulesTab isAdminOrManager={isAdminOrManager} />
          <DispenserTab isAdminOrManager={isAdminOrManager} />
        </div>
      )}
    </div>
  );
}
