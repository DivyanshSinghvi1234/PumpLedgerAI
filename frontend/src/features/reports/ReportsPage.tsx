import { useState } from "react";

import PageHeader from "@/components/common/PageHeader";

import VoucherReportSection from "./components/VoucherReportSection";
import CustomerReportSection from "./components/CustomerReportSection";
import LedgerReportSection from "./components/LedgerReportSection";
import DailySalesSection from "./components/DailySalesSection";
import DebtorAgingSection from "./components/DebtorAgingSection";

type Tab = "vouchers" | "customers" | "ledger" | "daily" | "aging";

const TABS: { key: Tab; label: string }[] = [
  { key: "vouchers", label: "Vouchers" },
  { key: "customers", label: "Customers" },
  { key: "ledger", label: "Ledger" },
  { key: "daily", label: "Daily Sales" },
  { key: "aging", label: "Debtor Aging" },
];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("vouchers");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Voucher, customer, ledger and daily sales reports."
      />

      <div className="flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "vouchers" && <VoucherReportSection />}
      {tab === "customers" && <CustomerReportSection />}
      {tab === "ledger" && <LedgerReportSection />}
      {tab === "daily" && <DailySalesSection />}
      {tab === "aging" && <DebtorAgingSection />}
    </div>
  );
}
