import { useNavigate } from "react-router-dom";
import { LogOut, Menu, Building2 } from "lucide-react";

import { logout } from "../../features/auth/services/authService";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface NavbarProps {
  onMenuClick(): void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const navigate = useNavigate();
  const { user, activePump } = useCurrentUser();

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

          <ThemeToggle />

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
