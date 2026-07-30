import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  UserCog,
  Plus,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Pencil,
  Building2,
  Download,
} from "lucide-react";
import { toast } from "sonner";

import api, { extractApiError } from "@/api/client";
import userService from "./services/userService";

import UserDialog from "./components/UserDialog";
import StationBrandingDialog from "@/features/settings/components/StationBrandingDialog";
import { useUserList } from "./hooks/useUserList";

import type { User } from "./types/user";

const ROLE_DISPLAY: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATOR: "Employee",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "text-error",
  MANAGER: "text-fuel-amber",
  OPERATOR: "text-ink-muted",
};

const ROLE_ICONS: Record<string, typeof Shield> = {
  ADMIN: ShieldAlert,
  MANAGER: ShieldCheck,
  OPERATOR: Shield,
};

export default function UserManagementPage() {
  const { data: users, isLoading, isError, error: queryError } = useUserList();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User>();

  const pageError = isError
    ? extractApiError(queryError, "Failed to load users.")
    : "";

  async function handleDownloadBackup() {
    try {
      toast.info("Preparing database backup download...");
      const response = await api.get("/v1/settings/backup/download", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      link.setAttribute("download", `pumpledger_backup_${today}.db`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Database backup downloaded successfully!");
    } catch (err) {
      toast.error("Failed to download database backup.");
    }
  }

  /* ---- User Deletion ---- */
  async function handleDelete(user: User) {
    if (!window.confirm(`Are you sure you want to permanently delete user "${user.username}"?`)) {
      return;
    }
    try {
      await userService.deleteUser(user.uuid);
      toast.success("User deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete user."));
    }
  }

  /* ---- Get User Status info (Online / Last Active / Inactive) ---- */
  function getUserStatus(user: User): { label: string; className: string; dotColor: string } {
    if (!user.is_active) {
      return {
        label: "Inactive",
        className: "text-ink-tertiary",
        dotColor: "bg-ink-tertiary",
      };
    }
    
    if (!user.last_active_at) {
      return {
        label: "Offline",
        className: "text-ink-subtle",
        dotColor: "bg-ink-muted",
      };
    }

    const lastActive = new Date(user.last_active_at).getTime();
    const now = Date.now();
    const differenceInMinutes = (now - lastActive) / 60000;

    if (differenceInMinutes < 5) {
      return {
        label: "Online",
        className: "text-success",
        dotColor: "bg-success animate-pulse",
      };
    }

    // Return a readable "Active X min/hours ago"
    let timeLabel = "Offline";
    if (differenceInMinutes < 60) {
      timeLabel = `Active ${Math.round(differenceInMinutes)}m ago`;
    } else if (differenceInMinutes < 1440) {
      timeLabel = `Active ${Math.round(differenceInMinutes / 60)}h ago`;
    } else {
      timeLabel = `Active ${Math.round(differenceInMinutes / 1440)}d ago`;
    }

    return {
      label: timeLabel,
      className: "text-ink-subtle",
      dotColor: "bg-ink-muted",
    };
  }

  function handleCreate() {
    setSelectedUser(undefined);
    setDialogOpen(true);
  }

  function handleEdit(user: User) {
    setSelectedUser(user);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuel-amber/10 border border-hairline">
            <UserCog size={20} className="text-fuel-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">User Management</h1>
            <p className="text-xs text-ink-muted">
              Manage users and their access roles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setBrandingOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-1 hover:bg-surface-2 text-ink px-4 py-2.5 text-sm font-semibold transition cursor-pointer"
          >
            <Building2 size={16} className="text-fuel-amber" />
            Station Branding
          </button>

          <button
            onClick={handleDownloadBackup}
            className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-1 hover:bg-surface-2 text-ink px-4 py-2.5 text-sm font-semibold transition cursor-pointer"
          >
            <Download size={16} className="text-emerald-500" />
            Download DB Backup
          </button>

          <button
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber text-canvas px-4 py-2.5 text-sm font-bold transition-all shadow-lg shadow-fuel-amber/25 hover:shadow-fuel-amber/35 cursor-pointer"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Error */}
      {pageError && (
        <div className="rounded-xl bg-error-muted border border-error/25 px-5 py-4 text-sm font-medium text-error flex items-start gap-3">
          <span className="mt-0.5 flex h-2 w-2 rounded-full bg-error shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-hairline bg-surface-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-2/50">
                <th className="px-5 py-3 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                  User
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                  Username
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                  Role
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                  Assigned Pumps
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-ink-muted">
                    Loading users…
                  </td>
                </tr>
              ) : !users || users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-ink-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const RoleIcon = ROLE_ICONS[user.role];
                  return (
                    <tr
                      key={user.uuid}
                      className="border-b border-hairline last:border-0 hover:bg-surface-2/30 transition"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full p-[2px] bg-gradient-to-br from-fuel-amber to-fuel-orange">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-ink">
                              {(user.full_name || user.username)
                                .split(" ")
                                .map((s) => s[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                          </div>
                          <span className="font-medium text-ink">
                            {user.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted font-mono text-xs">
                        {user.username}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ROLE_COLORS[user.role]}`}
                        >
                          <RoleIcon size={13} />
                          {ROLE_DISPLAY[user.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {user.role === "ADMIN" ? (
                            <span className="inline-flex items-center rounded-md bg-fuel-amber/15 border border-fuel-amber/20 px-1.5 py-0.5 text-[10px] font-semibold text-fuel-amber">
                              All Stations
                            </span>
                          ) : !user.pump_access || user.pump_access.length === 0 ? (
                            <span className="inline-flex items-center rounded-md bg-error/15 border border-error/20 px-1.5 py-0.5 text-[10px] font-semibold text-error">
                              None
                            </span>
                          ) : (
                            user.pump_access.map((pump) => (
                              <span
                                key={pump.uuid}
                                title={pump.name}
                                className="inline-flex items-center rounded-md bg-surface-3 border border-hairline px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted truncate max-w-[130px]"
                              >
                                {pump.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {(() => {
                          const statusInfo = getUserStatus(user);
                          return (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${statusInfo.className}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotColor}`} />
                              {statusInfo.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(user)}
                            className="rounded-lg p-1.5 text-ink-subtle hover:text-fuel-amber hover:bg-fuel-amber/10 transition cursor-pointer"
                            title="Edit user"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="rounded-lg p-1.5 text-ink-subtle hover:text-error hover:bg-error/10 transition cursor-pointer"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
      />
      <StationBrandingDialog
        open={brandingOpen}
        onOpenChange={setBrandingOpen}
      />
    </div>
  );
}
