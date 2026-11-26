import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  Menu,
  Building2,
  Calculator,
  Search,
  Fuel,
  X,
  HelpCircle,
  Command,
  SlidersHorizontal,
  Lock,
  RefreshCw,
} from "lucide-react";

import { logout } from "../../features/auth/services/authService";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePreferences } from "@/lib/preferences";
import { InstructorDrawer } from "@/features/guide/InstructorDrawer";
import api from "@/api/client";
import { formatCurrency } from "@/lib/utils";

interface NavbarProps {
  onMenuClick(): void;
  isSidebarOpen?: boolean;
  onOpenCmdK?: () => void;
  onLockPin?: () => void;
}

export default function Navbar({
  onMenuClick,
  isSidebarOpen,
  onOpenCmdK,
  onLockPin,
}: NavbarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activePump } = useCurrentUser();
  const { lang, toggleLang, t } = useLanguage();
  const {
    easyRead,
    setEasyRead,
    density,
    setDensity,
    sunlightMode,
    setSunlightMode,
    focusMode,
    setFocusMode,
    demoMode,
    setDemoMode,
    soundEnabled,
    setSoundEnabled,
  } = usePreferences();

  const [lookupQuery, setLookupQuery] = useState("");
  const [cashCalcOpen, setCashCalcOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [calcNotes, setCalcNotes] = useState({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 });
  const [syncState, setSyncState] = useState<{ ok: boolean; at: number }>({
    ok: true,
    at: Date.now(),
  });
  const [secsAgo, setSecsAgo] = useState(0);

  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail as { ok: boolean; at: number };
      setSyncState(detail);
      setSecsAgo(0);
    };
    window.addEventListener("pumpledger:sync-status", onSync);
    const interval = setInterval(() => {
      setSecsAgo((s) => s + 5);
    }, 5000);
    return () => {
      window.removeEventListener("pumpledger:sync-status", onSync);
      clearInterval(interval);
    };
  }, []);

  const { data: tanks = [] } = useQuery({
    queryKey: ["tanks-navbar"],
    queryFn: async () => {
      const res = await api.get("/fuel-tanks");
      return res.data as Array<{ uuid: string; name: string; fuel_type: string; current_stock_liters: number; capacity_liters: number }>;
    },
    staleTime: 60_000,
  });

  const { data: lookupResults = [] } = useQuery({
    queryKey: ["navbar-balance-lookup", lookupQuery],
    queryFn: async () => {
      const res = await api.get("/v1/customers/search/autocomplete", {
        params: { q: lookupQuery.trim(), limit: 5 },
      });
      return res.data as Array<{ uuid: string; name: string; outstanding_balance: number; mobile?: string }>;
    },
    enabled: lookupQuery.trim().length >= 2,
  });

  const calcTotal =
    calcNotes.n500 * 500 +
    calcNotes.n200 * 200 +
    calcNotes.n100 * 100 +
    calcNotes.n50 * 50 +
    calcNotes.n20 * 20 +
    calcNotes.n10 * 10;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials = (user?.full_name || user?.username || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="relative z-40 shrink-0 flex h-14 items-center justify-between border-b border-hairline bg-canvas/90 backdrop-blur-md px-4 md:px-6 font-sans">
      <div className="flex items-center gap-3">
        {/* Toggle Sidebar Menu Button */}
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 hover:bg-surface-3 text-ink cursor-pointer transition-colors"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          {/* Brand: PumpLedger with building icon */}
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-fuel-amber/10 text-fuel-amber">
              <Building2 size={14} />
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              PumpLedger
            </h2>
          </div>
          {activePump && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-fuel-amber/10 border border-fuel-amber/15 px-2 py-0.5 text-[10px] font-semibold text-fuel-amber">
              <span className="h-1 w-1 rounded-full bg-fuel-amber" />
              {activePump.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
          {/* Fuel Tank Live Stock Pill */}
          {tanks.length > 0 && (
            <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[10px] font-mono">
              <Fuel size={11} className="text-fuel-amber" />
              {tanks.slice(0, 3).map((t, i) => {
                const pct = t.capacity_liters > 0 ? Math.round((t.current_stock_liters / t.capacity_liters) * 100) : 0;
                const color = pct < 20 || pct > 95 ? "text-rose-500 font-bold" : pct < 35 ? "text-amber-500 font-semibold" : "text-emerald-500";
                const short = t.fuel_type === "DIESEL" ? "HSD" : t.fuel_type === "PETROL" ? "MS" : "SPD";
                return (
                  <span key={t.uuid} className={color}>
                    {i > 0 ? "· " : ""}{short} {pct}%
                  </span>
                );
              })}
            </div>
          )}

          {/* Top-Bar Instant Balance Lookup */}
          <div className="relative hidden md:block">
            <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2.5 py-1">
              <Search size={12} className="text-ink-muted" />
              <input
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder={t("Check Customer Due...")}
                className="w-36 bg-transparent text-xs text-ink outline-none placeholder:text-ink-subtle"
              />
              {lookupQuery && (
                <button type="button" onClick={() => setLookupQuery("")} className="text-ink-muted hover:text-ink cursor-pointer">
                  <X size={11} />
                </button>
              )}
            </div>
            {lookupQuery.trim().length >= 2 && lookupResults.length > 0 && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-hairline bg-surface-1 shadow-xl p-1.5 z-50 space-y-1">
                {lookupResults.map((c) => (
                  <button
                    key={c.uuid}
                    type="button"
                    onClick={() => {
                      setLookupQuery("");
                      navigate(`/dashboard/customers/${c.uuid}/ledger`);
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-surface-2 cursor-pointer text-left"
                  >
                    <span className="font-medium text-ink truncate">{c.name}</span>
                    <span className="font-mono font-bold text-fuel-amber shrink-0 ml-2">
                      {formatCurrency(c.outstanding_balance)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Cash Counter Widget */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCashCalcOpen((v) => !v)}
              className="rounded-lg border border-hairline bg-surface-2 p-1.5 text-ink-muted hover:text-ink hover:bg-surface-3 cursor-pointer"
              title="Quick Cash Denomination Counter"
            >
              <Calculator size={15} />
            </button>
            {cashCalcOpen && (
              <div className="fixed sm:absolute right-4 sm:right-0 top-14 sm:top-auto sm:mt-2 w-64 max-h-[80vh] overflow-y-auto rounded-xl border border-hairline bg-surface-1 shadow-2xl p-3 z-50 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-ink border-b border-hairline pb-1.5">
                  <span>{t("Quick Cash Counter")}</span>
                  <button type="button" onClick={() => setCalcNotes({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 })} className="text-[10px] text-fuel-amber hover:underline cursor-pointer">{t("Reset")}</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { k: "n500", l: "₹500" },
                    { k: "n200", l: "₹200" },
                    { k: "n100", l: "₹100" },
                    { k: "n50", l: "₹50" },
                    { k: "n20", l: "₹20" },
                    { k: "n10", l: "₹10" },
                  ] as const).map((d) => (
                    <div key={d.k} className="flex items-center gap-1.5">
                      <span className="w-9 font-mono text-ink-muted">{d.l}</span>
                      <input
                        type="number"
                        min="0"
                        value={calcNotes[d.k]}
                        onChange={(e) => setCalcNotes((p) => ({ ...p, [d.k]: Number(e.target.value) || 0 }))}
                        className="w-full rounded border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-ink"
                      />
                    </div>
                  ))}
                </div>
                <div className="border-t border-hairline pt-1.5 flex items-center justify-between font-mono font-bold text-emerald-500">
                  <span>{t("Total Cash")}</span>
                  <span>{formatCurrency(calcTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-hairline mx-1" />

          {user && (
            <div className="flex items-center gap-2.5">
              {/* Avatar with gradient ring */}
              <div className="rounded-full p-[2px] bg-gradient-to-br from-fuel-amber to-fuel-orange">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-bold text-ink">
                  {initials}
                </div>
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-medium text-ink">
                  {user.full_name || user.username}
                </p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-fuel-amber">
                  {t({ ADMIN: "Admin", MANAGER: "Manager", OPERATOR: "Employee" }[user.role] ?? user.role)}
                </p>
              </div>
            </div>
          )}

          {/* Live Sync Status Dot */}
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries()}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[10px] font-mono text-ink-muted hover:text-ink cursor-pointer"
            title="Live sync status — click to refresh"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                syncState.ok ? "bg-emerald-500" : "bg-rose-500 animate-pulse"
              }`}
            />
            {syncState.ok ? `Synced ${secsAgo}s ago` : "Retry"}
            {!syncState.ok && <RefreshCw size={10} />}
          </button>

          {/* Cmd+K Command Palette Button */}
          {onOpenCmdK && (
            <button
              type="button"
              onClick={onOpenCmdK}
              className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-[11px] font-mono text-ink-muted hover:text-ink hover:bg-surface-3 cursor-pointer"
              title="Command Palette (Cmd+K)"
            >
              <Command size={12} />
              <span>K</span>
            </button>
          )}

          {/* Interactive Instructor / Tutorial Guide */}
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-fuel-amber/40 bg-fuel-amber/10 px-2.5 py-1.5 text-xs font-bold text-fuel-amber hover:bg-fuel-amber/20 transition cursor-pointer"
            title={lang === "hi" ? "इंटरैक्टिव गाइड खोलें" : "Open Interactive Tutorial & Guide"}
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">{lang === "hi" ? "गाइड" : "Guide"}</span>
          </button>

          {/* Display & App Preferences Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setPrefsOpen((v) => !v)}
              className="rounded-lg border border-hairline bg-surface-2 p-1.5 text-ink-muted hover:text-ink hover:bg-surface-3 cursor-pointer"
              title="Display, Font Size, Sunlight Mode & PIN Lock"
            >
              <SlidersHorizontal size={15} />
            </button>
            {prefsOpen && (
              <div className="fixed sm:absolute right-4 sm:right-0 top-14 sm:top-auto sm:mt-2 w-60 max-h-[80vh] overflow-y-auto rounded-xl border border-hairline bg-surface-1 shadow-2xl p-3 z-50 space-y-2 text-xs">
                <div className="font-bold text-ink border-b border-hairline pb-1.5">
                  Display &amp; Forecourt Mode
                </div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Easy Read (Large Text)</span>
                  <input type="checkbox" checked={easyRead} onChange={(e) => setEasyRead(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Compact Table Rows</span>
                  <input
                    type="checkbox"
                    checked={density === "compact"}
                    onChange={(e) => setDensity(e.target.checked ? "compact" : "comfort")}
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Sunlight High-Contrast</span>
                  <input type="checkbox" checked={sunlightMode} onChange={(e) => setSunlightMode(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Save Chime Sound</span>
                  <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Focus Fullscreen</span>
                  <input
                    type="checkbox"
                    checked={focusMode}
                    onChange={(e) => {
                      setFocusMode(e.target.checked);
                      setPrefsOpen(false);
                    }}
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>Practice / Demo Mode</span>
                  <input type="checkbox" checked={demoMode} onChange={(e) => setDemoMode(e.target.checked)} />
                </label>
                {onLockPin && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrefsOpen(false);
                      onLockPin();
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface-2 py-1.5 font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                  >
                    <Lock size={12} /> Lock Screen (PIN)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Language Switcher: English / हिन्दी / Hinglish */}
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-surface-3 transition cursor-pointer"
            title="Switch Language: English / हिन्दी / Hinglish"
          >
            {lang === "en" ? "EN" : lang === "hi" ? "हिं" : "Hinglish"}
          </button>

          <ThemeToggle />

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition cursor-pointer ml-1"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">{t("Logout")}</span>
          </button>
        </div>
      <InstructorDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </header>
  );
}
