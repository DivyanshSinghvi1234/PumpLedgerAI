import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Compass,
  Fuel,
  FileText,
  Wallet,
  Moon,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import inventoryService from "@/features/inventory/services/inventoryService";
import bankAccountService from "@/features/admin/services/bankAccountService";

const GUIDE_HIDDEN_KEY = "pumpledger_hide_daily_guide";
const SETUP_DISMISSED_KEY = "pumpledger_dismiss_setup_checklist";

const DAILY_STEPS = [
  {
    step: "1. Morning",
    title: "Tank Dips & Meters",
    desc: "Check opening tank stock & nozzle meter readings.",
    path: "/dashboard/inventory",
    icon: Fuel,
  },
  {
    step: "2. All Day",
    title: "Invoices & Vouchers",
    desc: "Upload credit bills or record customer payments.",
    path: "/dashboard/vouchers",
    icon: FileText,
  },
  {
    step: "3. 8 PM",
    title: "Shift Settlement",
    desc: "Count forecourt cash & verify UPI/Card receipts.",
    path: "/dashboard/shift-settlement",
    icon: Wallet,
  },
  {
    step: "4. Night",
    title: "Day Closing",
    desc: "Lock daily meters & sync cash/UPI to bank.",
    path: "/dashboard/day-closing",
    icon: Moon,
  },
];

export default function DailyRoutineGuide() {
  const [guideCollapsed, setGuideCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUIDE_HIDDEN_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [setupDismissed, setSetupDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SETUP_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const { data: tanks } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
    staleTime: 60_000,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => bankAccountService.getBankAccounts(),
    staleTime: 60_000,
  });

  const hasTanks = (tanks?.length ?? 0) > 0;
  const hasBanks = (bankAccounts?.length ?? 0) > 0;
  const setupComplete = hasTanks && hasBanks;

  const toggleGuide = () => {
    const next = !guideCollapsed;
    setGuideCollapsed(next);
    try {
      localStorage.setItem(GUIDE_HIDDEN_KEY, String(next));
    } catch {
      // ignore storage errors
    }
  };

  const dismissSetup = () => {
    setSetupDismissed(true);
    try {
      localStorage.setItem(SETUP_DISMISSED_KEY, "true");
    } catch {
      // ignore storage errors
    }
  };

  return (
    <div className="space-y-4">
      {/* First-Time Setup Checklist (only shown until tanks & banks exist, or until dismissed) */}
      {!setupDismissed && !setupComplete && (
        <div className="rounded-xl border border-fuel-amber/30 bg-fuel-amber/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-fuel-amber shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-ink">First-Time Pump Setup</h2>
                <p className="text-xs text-ink-muted">
                  Complete these basics once so stock, vouchers, and bank balances stay in sync automatically.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissSetup}
              className="text-ink-subtle hover:text-ink cursor-pointer"
              title="Dismiss checklist"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Link
              to="/dashboard/inventory"
              className="flex items-center justify-between rounded-lg border border-hairline bg-surface-1/70 px-3 py-2 text-xs hover:border-fuel-amber/40 transition"
            >
              <span className="flex items-center gap-2 font-medium text-ink">
                {hasTanks ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={15} className="text-ink-subtle shrink-0" />
                )}
                Add Underground Fuel Tanks & Rates
              </span>
              <ArrowRight size={13} className="text-ink-subtle" />
            </Link>

            <Link
              to="/dashboard/bank-accounts"
              className="flex items-center justify-between rounded-lg border border-hairline bg-surface-1/70 px-3 py-2 text-xs hover:border-fuel-amber/40 transition"
            >
              <span className="flex items-center gap-2 font-medium text-ink">
                {hasBanks ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                ) : (
                  <Circle size={15} className="text-ink-subtle shrink-0" />
                )}
                Connect Bank Accounts (HDFC / SBI)
              </span>
              <ArrowRight size={13} className="text-ink-subtle" />
            </Link>
          </div>
        </div>
      )}

      {/* Daily Operating Playbook */}
      <div className="rounded-xl border border-hairline bg-surface-1/70 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-fuel-amber" />
            <h2 className="text-sm font-bold text-ink">Today&apos;s Pump Routine</h2>
            <span className="hidden sm:inline text-xs text-ink-subtle">
              — Follow these 4 steps in order each day
            </span>
          </div>
          <button
            type="button"
            onClick={toggleGuide}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink cursor-pointer transition"
          >
            {guideCollapsed ? (
              <>
                <span>Show Guide</span>
                <ChevronDown size={14} />
              </>
            ) : (
              <>
                <span>Hide</span>
                <ChevronUp size={14} />
              </>
            )}
          </button>
        </div>

        {!guideCollapsed && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {DAILY_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="group flex flex-col justify-between rounded-lg border border-hairline bg-surface-2/50 p-3 hover:border-fuel-amber/50 hover:bg-surface-2 transition"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-fuel-amber">
                        {item.step}
                      </span>
                      <Icon size={14} className="text-ink-subtle group-hover:text-fuel-amber transition" />
                    </div>
                    <p className="mt-1.5 text-xs font-bold text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted leading-snug">{item.desc}</p>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-fuel-amber opacity-80 group-hover:opacity-100">
                    <span>Open</span>
                    <ArrowRight size={12} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
