import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  Camera,
  Users,
  Fuel,
  Landmark,
  Settings,
  X,
  ChevronDown,
  ChevronRight,
  Star,
} from "lucide-react";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import type { UserRole } from "@/features/auth/services/authService";
import { useLanguage } from "@/i18n/LanguageContext";
import { usePreferences } from "@/lib/preferences";
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
  /** Collapse this section by default to reduce visual clutter. */
  defaultCollapsed?: boolean;
}

const menuItems: MenuGroup[] = [
  {
    section: "Pump Operations",
    items: [
      { title: "Daily Register", path: "/dashboard", icon: BookOpen },
      { title: "Slips & OCR", path: "/dashboard/slips", icon: Camera },
      {
        title: "Customers & Vehicles",
        path: "/dashboard/customers",
        icon: Users,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Inventory",
        path: "/dashboard/inventory",
        icon: Fuel,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
      {
        title: "Money & Profit",
        path: "/dashboard/money",
        icon: Landmark,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
    ],
  },
  {
    section: "More",
    allowedRoles: ["ADMIN", "MANAGER"],
    items: [
      {
        title: "Settings & Tools",
        path: "/dashboard/settings",
        icon: Settings,
        allowedRoles: ["ADMIN", "MANAGER"],
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  isMini?: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, isMini = false, onClose }: SidebarProps) {
  const { t } = useLanguage();
  const { favorites, toggleFavorite } = usePreferences();
  const { hasRole } = useCurrentUser();
  const location = useLocation();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of menuItems) {
      if (group.defaultCollapsed) {
        const hasActiveChild = group.items.some((item) => location.pathname.startsWith(item.path));
        initial[group.section] = !hasActiveChild;
      }
    }
    return initial;
  });

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-hairline glass font-sans transition-all duration-300 ${
          isMini ? "md:w-[72px]" : "w-[260px]"
        } ${
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
        {!isMini && (
          <div className="relative z-30 px-5 py-3 border-b border-hairline bg-surface-2/20 backdrop-blur-xs">
            <PumpSwitcher />
          </div>
        )}

        {/* Nav List */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
          {/* Pinned Favorites */}
          {!isMini && favorites.length > 0 && (() => {
            const allItems = menuItems.flatMap((g) => g.items).filter((i) => isAllowed(i.allowedRoles));
            const favItems = allItems.filter((i) => favorites.includes(i.path));
            if (favItems.length === 0) return null;
            return (
              <div>
                <div className="mb-2 flex items-center gap-1.5 px-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-fuel-amber">
                  <Star size={10} className="fill-fuel-amber" />
                  <span>Pinned</span>
                </div>
                <div className="space-y-0.5">
                  {favItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={`fav-${item.path}`}
                        to={item.path}
                        end={item.path === "/dashboard"}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `group flex items-center gap-3 py-1.5 px-3 text-[13px] font-medium rounded-lg transition-all ${
                            isActive
                              ? "nav-active-bar bg-gradient-to-r from-fuel-amber/10 to-transparent text-ink font-semibold"
                              : "text-ink-muted hover:bg-surface-3/60 hover:text-ink"
                          }`
                        }
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md text-fuel-amber">
                          <Icon size={14} />
                        </div>
                        <span className="truncate">{t(item.title)}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {menuItems
            .filter((group) => isAllowed(group.allowedRoles))
            .map((group) => {
              const visibleItems = group.items.filter((item) =>
                isAllowed(item.allowedRoles)
              );

              if (visibleItems.length === 0) return null;

              const isCollapsed = Boolean(collapsedSections[group.section]);

              return (
                <div key={group.section}>
                  <button
                    type="button"
                    onClick={() => toggleSection(group.section)}
                    className="mb-2 flex w-full items-center justify-between px-3 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary hover:text-ink-muted cursor-pointer transition"
                  >
                    <span>{t(group.section)}</span>
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {!isCollapsed && (
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
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                                  isActive
                                    ? "bg-fuel-amber/15 text-fuel-amber"
                                    : "text-ink-subtle group-hover:text-ink-muted"
                                }`}>
                                  <Icon size={15} />
                                </div>
                                {!isMini && (
                                  <>
                                    <span className="flex-1 truncate">{t(item.title)}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleFavorite(item.path);
                                      }}
                                      title="Pin / Unpin favorite"
                                      className="opacity-0 group-hover:opacity-100 text-ink-subtle hover:text-fuel-amber transition cursor-pointer"
                                    >
                                      <Star
                                        size={12}
                                        className={favorites.includes(item.path) ? "fill-fuel-amber text-fuel-amber" : ""}
                                      />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
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

