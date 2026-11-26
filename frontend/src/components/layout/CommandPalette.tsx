import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Command, Search, ArrowRight, Sun, Maximize2, Zap, Moon, Landmark } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { usePreferences } from "@/lib/preferences";
import { useLanguage } from "@/i18n/LanguageContext";
import api from "@/api/client";
import { formatCurrency } from "@/lib/utils";

const QUICK_NAV = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Quick Entry", path: "/dashboard/quick-entry" },
  { label: "Vouchers", path: "/dashboard/vouchers" },
  { label: "Payments", path: "/dashboard/payments" },
  { label: "Day Closing", path: "/dashboard/day-closing" },
  { label: "8 PM Settlement", path: "/dashboard/shift-settlement" },
  { label: "Inventory & Meter Readings", path: "/dashboard/inventory" },
  { label: "Customers", path: "/dashboard/customers" },
  { label: "Vehicles", path: "/dashboard/vehicles" },
  { label: "Bank & Cash Accounts", path: "/dashboard/bank-accounts" },
  { label: "Daily Register", path: "/dashboard/register" },
  { label: "Revenue / Expenses", path: "/dashboard/income" },
  { label: "Staff & Payroll", path: "/dashboard/staff" },
  { label: "Command Center", path: "/dashboard/command-center" },
  { label: "Reports", path: "/dashboard/reports" },
  { label: "Tally Sync", path: "/dashboard/tally" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { sunlightMode, setSunlightMode, focusMode, setFocusMode } = usePreferences();
  const { t } = useLanguage();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { data: customers = [] } = useQuery({
    queryKey: ["cmd-k-customers", query],
    queryFn: async () => {
      const res = await api.get("/v1/customers/search/autocomplete", {
        params: { q: query.trim(), limit: 5 },
      });
      return res.data as Array<{ uuid: string; name: string; outstanding_balance: number }>;
    },
    enabled: open && query.trim().length >= 2,
  });

  const filteredNav = QUICK_NAV.filter((n) =>
    n.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(92vw,620px)] sm:max-w-2xl p-0 overflow-hidden gap-0"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page, search customer, or run action... (Cmd+K)"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            <Command size={10} />K
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-3 text-xs">
          {/* Quick Actions */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Quick Actions
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => go("/dashboard/quick-entry")}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted text-left cursor-pointer"
              >
                <Zap size={14} className="text-fuel-amber" /> New Quick Slip
              </button>
              <button
                type="button"
                onClick={() => go("/dashboard/day-closing")}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted text-left cursor-pointer"
              >
                <Moon size={14} className="text-indigo-400" /> Close Business Day
              </button>
              <button
                type="button"
                onClick={() => go("/dashboard/bank-accounts")}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted text-left cursor-pointer"
              >
                <Landmark size={14} className="text-emerald-500" /> Deposit Cash to Bank
              </button>
              <button
                type="button"
                onClick={() => {
                  setSunlightMode(!sunlightMode);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted text-left cursor-pointer"
              >
                <Sun size={14} className="text-amber-500" />
                {sunlightMode ? "Disable Sunlight Mode" : "Enable Sunlight Mode"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusMode(!focusMode);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-muted text-left cursor-pointer col-span-2"
              >
                <Maximize2 size={14} className="text-blue-400" />
                {focusMode ? "Exit Focus Fullscreen" : "Enter Focus Fullscreen"}
              </button>
            </div>
          </div>

          {/* Matching Customers */}
          {customers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Customers (Live Due)
              </div>
              {customers.map((c) => (
                <button
                  key={c.uuid}
                  type="button"
                  onClick={() => go(`/dashboard/customers/${c.uuid}/ledger`)}
                  className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-muted text-left cursor-pointer"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="font-mono font-bold text-fuel-amber">
                    {formatCurrency(c.outstanding_balance)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Pages */}
          <div>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Screens
            </div>
            {filteredNav.map((n) => (
              <button
                key={n.path}
                type="button"
                onClick={() => go(n.path)}
                className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-muted text-left cursor-pointer"
              >
                <span>{t(n.label)}</span>
                <ArrowRight size={12} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
