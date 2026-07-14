import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Search,
  Eye,
  Info,
  User,
  FileCode,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import auditService from "./services/auditService";
import type { AuditLog } from "./types";

export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Queries
  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => auditService.getAuditLogs(),
  });

  const filteredLogs = (logs ?? []).filter((log) => {
    const term = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.target_table.toLowerCase().includes(term) ||
      log.target_id.toLowerCase().includes(term) ||
      (log.actor_id && String(log.actor_id).includes(term))
    );
  });

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith("CREATE_")) return "bg-success/10 text-success border-success/20";
    if (action.startsWith("DELETE_")) return "bg-destructive/10 text-destructive border-destructive/20";
    if (action.startsWith("UPDATE_")) return "bg-fuel-amber/10 text-fuel-amber border-fuel-amber/20";
    if (action.includes("REVERSE_")) return "bg-destructive/15 text-destructive border-destructive/20";
    return "bg-surface-3 text-ink-subtle border-hairline";
  };

  const parseChanges = (jsonStr: string | null) => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <EmptyState message="Unable to load audit logs." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Audit Trail"
          description="View read-only chronological log of all database updates, financial mutations, and attendant actions."
        />
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-tertiary" />
          <Input
            placeholder="Search action or table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-surface-2 border-hairline outline-none text-sm text-ink placeholder:text-ink-subtle"
          />
        </div>
      </div>

      <Card className="glass border-hairline">
        <CardHeader className="pb-3 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
              <Shield size={15} />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight text-ink">
                Immutable Operation Ledger
              </CardTitle>
              <CardDescription className="text-xs text-ink-subtle">
                Append-only log containing details of creations, modifications, and deletions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-hairline hover:bg-transparent">
                  <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Timestamp
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Action
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Target Type
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Target ID
                  </TableHead>
                  <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                    Actor
                  </TableHead>
                  <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                    Detail
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const changes = parseChanges(log.changes_json);
                    return (
                      <TableRow key={log.id} className="border-b border-hairline hover:bg-surface-3/35">
                        <TableCell className="px-5 text-xs font-semibold text-ink py-3.5">
                          {new Date(log.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-mono font-bold tracking-wide uppercase px-2 py-0.5 border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono font-semibold text-ink-muted">
                          {log.target_table}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-ink-muted">
                          {log.target_id}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-ink-muted">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-ink-tertiary" />
                            <span>{log.actor_id ? `User ${log.actor_id}` : "System"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 text-right">
                          {changes ? (
                            <Button
                              onClick={() => setSelectedLog(log)}
                              variant="outline"
                              className="border-hairline hover:bg-surface-3 hover:text-ink text-[11px] font-semibold h-7 py-0 px-2.5 cursor-pointer"
                            >
                              <Eye size={12} className="mr-1.5 text-fuel-amber" /> View Changes
                            </Button>
                          ) : (
                            <span className="text-[10px] text-ink-tertiary flex items-center gap-1 justify-end">
                              <Info size={11} /> No payload
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="h-28 text-center text-xs text-ink-subtle">
                      No matching audit log records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Changes payload detail modal */}
      <Dialog open={selectedLog !== null} onOpenChange={() => setSelectedLog(null)}>
        {selectedLog && (
          <DialogContent className="glass border border-hairline sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold tracking-tight text-ink flex items-center gap-2">
                <FileCode size={16} className="text-fuel-amber" /> Changes Payload Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center bg-surface-2 p-3 rounded-lg border border-hairline text-xs">
                <div>
                  <span className="text-ink-tertiary">Action:</span>{" "}
                  <span className="font-bold text-ink">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-ink-tertiary">Table:</span>{" "}
                  <span className="font-mono text-ink">{selectedLog.target_table}</span>
                </div>
              </div>

              {/* JSON diff renderer */}
              <div className="space-y-3">
                {(() => {
                  const payload = parseChanges(selectedLog.changes_json);
                  if (!payload) return null;
                  const showBefore = payload.before && Object.keys(payload.before).length > 0;
                  const showAfter = payload.after && Object.keys(payload.after).length > 0;

                  return (
                    <div className="grid gap-4 text-xs">
                      {showBefore && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-destructive">State BEFORE mutation</Label>
                          <pre className="bg-destructive/5 border border-destructive/10 rounded-md p-3 font-mono text-[11px] overflow-auto max-h-48 text-ink">
                            {JSON.stringify(payload.before, null, 2)}
                          </pre>
                        </div>
                      )}
                      {showAfter && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-success">State AFTER mutation</Label>
                          <pre className="bg-success/5 border border-success/10 rounded-md p-3 font-mono text-[11px] overflow-auto max-h-48 text-ink">
                            {JSON.stringify(payload.after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setSelectedLog(null)}
                className="bg-surface-3 border-hairline hover:bg-surface-3/80 text-ink text-xs font-semibold px-4 cursor-pointer"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
