import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { FileCode, History, Settings, UserCog, Users } from "lucide-react";

import LoadingState from "@/components/common/LoadingState";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

const StaffPayrollPage = lazy(() => import("@/features/staff/StaffPayrollPage"));
const TallyExportPage = lazy(() => import("@/features/tally/TallyExportPage"));
const UserManagementPage = lazy(() => import("@/features/users/UserManagementPage"));
const AuditLogPage = lazy(() => import("@/features/audit/AuditLogPage"));

type ToolsTab = "staff" | "tally" | "audit" | "users";

export default function MoreToolsPage() {
  const { hasRole } = useCurrentUser();
  const isAdmin = hasRole("ADMIN");
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: ToolsTab =
    rawTab === "tally" || rawTab === "audit" || (rawTab === "users" && isAdmin)
      ? rawTab
      : "staff";

  const setTab = (tab: ToolsTab) => {
    setSearchParams(tab === "staff" ? {} : { tab }, { replace: true });
  };

  const tabs: { key: ToolsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "staff", label: "Staff & Payroll", icon: UserCog },
    { key: "tally", label: "Tally Export", icon: FileCode },
    { key: "audit", label: "Activity Log", icon: History },
    ...(isAdmin ? [{ key: "users" as const, label: "Users & Backup", icon: Users }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <Settings className="h-5 w-5 text-fuel-amber" />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Settings &amp; Optional Tools</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Monthly payroll, Tally XML export, activity log, station branding, and database backup.
          </p>
        </div>
      </div>

      <div className="flex border-b border-hairline gap-3 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 pb-3 px-2 text-sm border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                active
                  ? "border-fuel-amber text-ink font-bold"
                  : "border-transparent text-ink-muted hover:text-ink font-medium"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<LoadingState />}>
        {activeTab === "staff" && <StaffPayrollPage />}
        {activeTab === "tally" && <TallyExportPage />}
        {activeTab === "audit" && <AuditLogPage />}
        {activeTab === "users" && isAdmin && <UserManagementPage />}
      </Suspense>
    </div>
  );
}
