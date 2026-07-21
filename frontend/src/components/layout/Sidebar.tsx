import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Users,
  Truck,
  Wallet,
  BarChart3,
  Fuel,
  FileCode,
  History,
  X,
  UserCog,
  Coins,
  BookOpen,
} from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import type { UserRole } from "@/features/auth/services/authService";
import PumpSwitcher from "./PumpSwitcher";

interface MenuItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ size?: number }>;
  /** If set, only these roles see this item. Omit = visible to all. */
  allowedRoles?: UserRole[];
}

interface MenuGroup {
  section: string;
  items: MenuItem[];
  /** If set, only these roles see this entire section. */
  allowedRoles?: UserRole[];
}

const menuItems: MenuGroup[] = [
  {
    section: "Overview",
    items: [
      { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Operations",
    items: [
      { title: "Upload Invoice", path: "/dashboard/upload", icon: Upload },
      { title: "Vouchers", path: "/dashboard/vouchers", icon: FileText },
      {
        title: "Payments",
        path: "/dashboard/payments",
        icon: Wallet,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Tally Sync",
        path: "/dashboard/tally",
        icon: FileCode,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Inventory",
        path: "/dashboard/inventory",
        icon: Fuel,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Income / Expenses",
        path: "/dashboard/income",
        icon: Coins,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    section: "Records",
    items: [
      {
        title: "Daily Register",
        path: "/dashboard/register",
        icon: BookOpen,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Customers",
        path: "/dashboard/customers",
        icon: Users,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Vehicles",
        path: "/dashboard/vehicles",
        icon: Truck,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Reports",
        path: "/dashboard/reports",
        icon: BarChart3,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Audit Trail",
        path: "/dashboard/audit",
        icon: History,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    section: "Administration",
    allowedRoles: ["ADMIN"],
    items: [
      {
        title: "User Management",
        path: "/dashboard/users",
        icon: UserCog,
        allowedRoles: ["ADMIN"],
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { hasRole } = useCurrentUser();

  /** Check whether the current user can see a given item / section. */
  function isAllowed(roles?: UserRole[]): boolean {
    if (!roles || roles.length === 0) return true;
    return hasRole(...roles);
  }

  const handleNavClick = () => {
    // Only close drawer automatically on small mobile screens (< 768px)
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar container — glassmorphic */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-hairline glass font-sans transition-all duration-300 ${
          isOpen ? "translate-x-0 md:ml-0" : "-translate-x-full md:-ml-[260px]"
        } md:static md:z-30`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuel-amber to-fuel-orange text-canvas shadow-md shadow-fuel-amber/20">
              <Fuel size={16} strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-ink">
                PumpLedger
              </p>
              <p className="text-[9px] font-mono text-fuel-amber uppercase tracking-wider">
                AI Platform
              </p>
            </div>
          </div>
          
          {/* Close menu button (enabled on all screens including laptop) */}
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-surface-3 text-ink-subtle hover:text-ink cursor-pointer transition"
            aria-label="Close menu"
            title="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Pump Switcher Section */}
        <div className="relative z-30 px-5 py-3 border-b border-hairline bg-surface-2/20 backdrop-blur-xs">
          <PumpSwitcher />
        </div>

        {/* Nav List */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {menuItems
            .filter((group) => isAllowed(group.allowedRoles))
            .map((group) => {
              const visibleItems = group.items.filter((item) =>
                isAllowed(item.allowedRoles)
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={group.section}>
                  <p className="mb-2.5 px-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                    {group.section}
                  </p>

                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          end={item.path === "/dashboard"}
                          onClick={handleNavClick}
                          className={({ isActive }) =>
                            `group flex items-center gap-3 py-2 px-3 text-[13px] font-medium rounded-lg transition-all duration-150 ${
                              isActive
                                ? "nav-active-bar bg-gradient-to-r from-fuel-amber/10 to-transparent text-ink font-semibold"
                                : "text-ink-muted hover:bg-surface-3/60 hover:text-ink"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <div className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                                isActive
                                  ? "bg-fuel-amber/15 text-fuel-amber"
                                  : "text-ink-subtle group-hover:text-ink-muted"
                              }`}>
                                <Icon size={15} />
                              </div>
                              <span>{item.title}</span>
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </nav>

        {/* Footer */}
        <div className="border-t border-hairline px-5 py-3.5 flex items-center justify-between">
          <p className="text-[10px] font-mono text-ink-tertiary">
            v1.0 · Fuel Dark
          </p>
          <span className="relative flex h-2 w-2 rounded-full bg-success fuel-pulse" />
        </div>
      </aside>
    </>
  );
}

