import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Camera, FileText, Zap } from "lucide-react";

import LoadingState from "@/components/common/LoadingState";

const UploadPage = lazy(() => import("@/features/upload/UploadPage"));
const QuickEntryPage = lazy(() => import("@/features/vouchers/QuickEntryPage"));
const VoucherListPage = lazy(() => import("@/features/vouchers/VoucherListPage"));

type SlipsTab = "scan" | "quick" | "list";

const TABS: { key: SlipsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "scan", label: "Scan Invoice (OCR)", icon: Camera },
  { key: "quick", label: "Quick Manual Slip", icon: Zap },
  { key: "list", label: "Stored Slips & Invoices", icon: FileText },
];

export default function SlipsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: SlipsTab =
    rawTab === "quick" || rawTab === "list" ? rawTab : "scan";

  const setTab = (tab: SlipsTab) => {
    setSearchParams(tab === "scan" ? {} : { tab }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Slips &amp; OCR</h1>
        <p className="text-xs text-ink-muted mt-0.5">
          Scan &amp; store invoices with AI OCR or add a manual slip — automatically updates Customer Ledger &amp; Today&apos;s Register.
        </p>
      </div>

      <div data-tour="slips-tabs" className="flex border-b border-hairline gap-3 overflow-x-auto">
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

      <div data-tour="slips-content">
        <Suspense fallback={<LoadingState />}>
          {activeTab === "scan" && <UploadPage />}
          {activeTab === "quick" && <QuickEntryPage />}
          {activeTab === "list" && <VoucherListPage />}
        </Suspense>
      </div>
    </div>
  );
}
