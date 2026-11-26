import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { Home, Zap, FileText, Moon } from "lucide-react";

import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import OfflineBanner from "../components/layout/OfflineBanner";
import { isAuthenticated } from "../features/auth/services/authService";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AppLayout() {
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar_open");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const handleToggleSidebar = () => {
    setSidebarOpen((prev: boolean) => {
      const next = !prev;
      localStorage.setItem("sidebar_open", JSON.stringify(next));
      return next;
    });
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300">
        <Navbar onMenuClick={handleToggleSidebar} isSidebarOpen={sidebarOpen} />
        <OfflineBanner />

        <main className="relative flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {/* Subtle dot-grid background */}
          <div className="absolute inset-0 dot-grid pointer-events-none" />
          {/* Warm glow at top (light mode only) */}
          <div className="absolute top-0 left-0 right-0 h-48 fuel-glow pointer-events-none dark:hidden" />

          <div className="relative z-10 animate-fade-in-up pb-16 md:pb-0">
            <Outlet />
          </div>
        </main>

        {/* Zero-Friction Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-hairline bg-canvas/95 backdrop-blur-md py-2 px-2">
          {[
            { to: "/dashboard", label: "Home", icon: Home, end: true },
            { to: "/dashboard/quick-entry", label: "Quick Entry", icon: Zap, end: false },
            { to: "/dashboard/vouchers", label: "Vouchers", icon: FileText, end: false },
            { to: "/dashboard/day-closing", label: "Day Close", icon: Moon, end: false },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 text-[10px] font-semibold px-3 py-1 rounded-lg ${
                    isActive ? "text-fuel-amber" : "text-ink-muted"
                  }`
                }
              >
                <Icon size={18} />
                <span>{t(item.label)}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
