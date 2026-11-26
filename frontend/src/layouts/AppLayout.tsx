import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Home,
  Zap,
  FileText,
  Moon,
  Plus,
  Maximize2,
  Download,
  Loader2,
  FlaskConical,
  ChevronRight,
} from "lucide-react";

import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import OfflineBanner from "../components/layout/OfflineBanner";
import { CommandPalette } from "../components/layout/CommandPalette";
import { PinLockOverlay } from "../components/layout/PinLockOverlay";
import { isAuthenticated } from "../features/auth/services/authService";
import { useCurrentUser } from "../features/auth/hooks/useCurrentUser";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePreferences } from "@/lib/preferences";

export default function AppLayout() {
  const { t } = useLanguage();
  const { user } = useCurrentUser();
  const location = useLocation();
  const { focusMode, setFocusMode, demoMode, setDemoMode } = usePreferences();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return false;
    }
    try {
      const saved = localStorage.getItem("sidebar_open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [sidebarMini, setSidebarMini] = useState(() => {
    try {
      return localStorage.getItem("sidebar_mini") === "true";
    } catch {
      return false;
    }
  });

  const [cmdOpen, setCmdOpen] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem("pwa_install_dismissed") === "true"
  );

  useEffect(() => {
    const onSlow = (e: Event) => setSlowServer(Boolean((e as CustomEvent).detail));
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("pumpledger:slow-server", onSlow);
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      window.removeEventListener("pumpledger:slow-server", onSlow);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  // 10-minute inactivity auto-lock for PIN Quick-Switch
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setPinLocked(true), 10 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, []);

  const handleToggleSidebar = () => {
    if (window.innerWidth >= 768) {
      setSidebarMini((prev) => {
        const next = !prev;
        localStorage.setItem("sidebar_mini", String(next));
        return next;
      });
      if (!sidebarOpen) setSidebarOpen(true);
    } else {
      setSidebarOpen((prev: boolean) => {
        const next = !prev;
        localStorage.setItem("sidebar_open", JSON.stringify(next));
        return next;
      });
    }
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Role-based home redirect for Operators landing on /dashboard
  if (user?.role === "OPERATOR" && location.pathname === "/dashboard") {
    return <Navigate to="/dashboard/quick-entry" replace />;
  }

  const segments = location.pathname.split("/").filter(Boolean);

  return (
    <div className="flex h-[100dvh] w-full max-w-full bg-canvas overflow-hidden">
      {!focusMode && (
        <Sidebar
          isOpen={sidebarOpen}
          isMini={sidebarMini}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden transition-all duration-300">
        {!focusMode && (
          <Navbar
            onMenuClick={handleToggleSidebar}
            isSidebarOpen={sidebarOpen}
            onOpenCmdK={() => setCmdOpen(true)}
            onLockPin={() => setPinLocked(true)}
          />
        )}

        <OfflineBanner />

        {/* Render Cold-Start Wake-Up Banner */}
        {slowServer && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-3 py-2 text-[11px] sm:text-xs font-semibold text-amber-600 dark:text-amber-300 flex items-center justify-center gap-2 text-center no-print">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span>Waking up server (~20s on free tier)... Your data is safe.</span>
          </div>
        )}

        {/* Demo / Practice Mode Banner */}
        {demoMode && (
          <div className="bg-indigo-500/15 border-b border-indigo-500/30 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-indigo-500 flex flex-wrap items-center justify-between gap-2 no-print">
            <span className="flex items-center gap-1.5">
              <FlaskConical size={13} className="shrink-0" /> Practice / Demo Mode Active
            </span>
            <button
              type="button"
              onClick={() => setDemoMode(false)}
              className="underline cursor-pointer"
            >
              Exit Practice Mode
            </button>
          </div>
        )}

        {/* PWA Install App Banner */}
        {installPrompt && !installDismissed && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-3 py-2 text-[11px] sm:text-xs flex flex-wrap items-center justify-between gap-2 no-print">
            <span className="font-semibold text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
              <Download size={14} className="shrink-0" /> Install PumpLedgerAI for native speed.
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={async () => {
                  await installPrompt.prompt();
                  setInstallPrompt(null);
                }}
                className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
              >
                Install App
              </button>
              <button
                type="button"
                onClick={() => {
                  setInstallDismissed(true);
                  localStorage.setItem("pwa_install_dismissed", "true");
                }}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <main className="relative flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="absolute inset-0 dot-grid pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-48 fuel-glow pointer-events-none dark:hidden" />

          {/* Focus Mode Exit Pill */}
          {focusMode && (
            <button
              type="button"
              onClick={() => setFocusMode(false)}
              className="fixed top-3 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-1 px-3 py-1.5 text-xs font-bold text-ink shadow-lg hover:bg-surface-2 cursor-pointer no-print"
            >
              <Maximize2 size={12} /> Exit Focus Mode
            </button>
          )}

          {/* Quick-Jump Breadcrumbs */}
          {segments.length > 1 && !focusMode && (
            <div className="relative z-10 mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted no-print">
              <Link to="/dashboard" className="hover:text-ink font-medium">
                {t("Dashboard")}
              </Link>
              {segments.slice(1).map((seg, i) => {
                const to = "/" + segments.slice(0, i + 2).join("/");
                const label = seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const isLast = i === segments.length - 2;
                return (
                  <span key={to} className="flex items-center gap-1.5">
                    <ChevronRight size={11} />
                    {isLast ? (
                      <span className="font-semibold text-ink">{label}</span>
                    ) : (
                      <Link to={to} className="hover:text-ink">
                        {label}
                      </Link>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <div
            key={location.pathname}
            className="relative z-10 page-enter min-w-0 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0"
          >
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Dock matching the 5-page app */}
        {!focusMode && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-hairline bg-canvas/95 backdrop-blur-md pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] no-print">
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] text-[10px] font-semibold px-1.5 py-1 rounded-lg ${
                  isActive ? "text-fuel-amber" : "text-ink-muted"
                }`
              }
            >
              <Home size={18} />
              <span>{t("Register")}</span>
            </NavLink>

            {user?.role !== "OPERATOR" && (
              <NavLink
                to="/dashboard/customers"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] text-[10px] font-semibold px-1.5 py-1 rounded-lg ${
                    isActive ? "text-fuel-amber" : "text-ink-muted"
                  }`
                }
              >
                <FileText size={18} />
                <span>{t("Customers")}</span>
              </NavLink>
            )}

            <NavLink
              to="/dashboard/slips"
              className="-mt-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fuel-amber text-canvas shadow-lg shadow-fuel-amber/30 border-4 border-canvas"
              title="Scan or Add Slip"
            >
              <Plus size={22} strokeWidth={2.5} />
            </NavLink>

            {user?.role !== "OPERATOR" && (
              <NavLink
                to="/dashboard/inventory"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] text-[10px] font-semibold px-1.5 py-1 rounded-lg ${
                    isActive ? "text-fuel-amber" : "text-ink-muted"
                  }`
                }
              >
                <Zap size={18} />
                <span>{t("Inventory")}</span>
              </NavLink>
            )}

            {user?.role !== "OPERATOR" && (
              <NavLink
                to="/dashboard/money"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 min-w-[54px] min-h-[44px] text-[10px] font-semibold px-1.5 py-1 rounded-lg ${
                    isActive ? "text-fuel-amber" : "text-ink-muted"
                  }`
                }
              >
                <Moon size={18} />
                <span>{t("Money")}</span>
              </NavLink>
            )}
          </nav>
        )}
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
      <PinLockOverlay locked={pinLocked} onUnlock={() => setPinLocked(false)} />
    </div>
  );
}
