import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, Menu, Bell } from "lucide-react";

import { logout } from "../../features/auth/services/authService";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/upload": "Upload Invoice",
  "/dashboard/vouchers": "Vouchers",
  "/dashboard/payments": "Payments",
  "/dashboard/customers": "Customers",
  "/dashboard/vehicles": "Vehicles",
  "/dashboard/reports": "Reports",
  "/dashboard/review": "OCR Review",
};

function titleFor(path: string): string {
  if (TITLES[path]) return TITLES[path];
  if (path.startsWith("/dashboard/customers") && path.includes("ledger")) {
    return "Customer Ledger";
  }
  return "PumpLedger";
}

interface NavbarProps {
  onMenuClick(): void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();

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
    <header className="flex h-14 items-center justify-between border-b border-hairline bg-canvas/80 backdrop-blur-md px-4 md:px-6 font-sans">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu on Mobile */}
        <button
          onClick={onMenuClick}
          className="rounded-md p-1.5 hover:bg-surface-3 md:hidden text-ink cursor-pointer"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>

        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            {titleFor(location.pathname)}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Notification bell (visual placeholder) */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-3 transition cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-fuel-amber" />
        </button>

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
                {{ ADMIN: "Admin", MANAGER: "Manager", OPERATOR: "Employee" }[user.role] ?? user.role}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition cursor-pointer ml-1"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
