import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Truck, Users, Wallet } from "lucide-react";

import LoadingState from "@/components/common/LoadingState";

const CustomerListPage = lazy(() => import("@/features/customers/CustomerListPage"));
const VehicleListPage = lazy(() => import("@/features/vehicles/VehicleListPage"));
const PaymentListPage = lazy(() => import("@/features/payments/PaymentListPage"));

type CustomersTab = "customers" | "vehicles" | "payments";

const TABS: { key: CustomersTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "customers", label: "Customers & Dues", icon: Users },
  { key: "vehicles", label: "Vehicles", icon: Truck },
  { key: "payments", label: "Payments Received", icon: Wallet },
];

export default function CustomersHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: CustomersTab =
    rawTab === "vehicles" || rawTab === "payments" ? rawTab : "customers";

  const setTab = (tab: CustomersTab) => {
    setSearchParams(tab === "customers" ? {} : { tab }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Customers &amp; Vehicles</h1>
        <p className="text-xs text-ink-muted mt-0.5">
          Track credit balances, vehicle-wise fuel slips, and record payments (auto-updates Cash &amp; Bank balances).
        </p>
      </div>

      <div data-tour="customers-tabs" className="flex border-b border-hairline gap-3 overflow-x-auto">
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

      <div data-tour="customers-content">
        <Suspense fallback={<LoadingState />}>
          {activeTab === "customers" && <CustomerListPage />}
          {activeTab === "vehicles" && <VehicleListPage />}
          {activeTab === "payments" && <PaymentListPage />}
        </Suspense>
      </div>
    </div>
  );
}
