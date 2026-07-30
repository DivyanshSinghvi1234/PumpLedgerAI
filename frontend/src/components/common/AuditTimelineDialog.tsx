import { useQuery } from "@tanstack/react-query";
import { History, User, Clock, ShieldCheck, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import auditService from "@/features/audit/services/auditService";

interface AuditTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  targetTable?: string;
  targetId?: string | number;
}

export default function AuditTimelineDialog({
  open,
  onOpenChange,
  title,
  targetTable,
  targetId,
}: AuditTimelineDialogProps) {
  const { data: logs, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", targetTable, targetId],
    queryFn: () => auditService.getAuditLogs({ targetTable, targetId }),
    enabled: open,
  });

  const parseChanges = (changesJson: string | null) => {
    if (!changesJson) return null;
    try {
      return JSON.parse(changesJson);
    } catch {
      return changesJson;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border border-hairline sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-3 border-b border-hairline">
          <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
            <History size={18} className="text-fuel-amber" /> {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-subtle">
            Complete immutable audit log & modification history timeline
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto pr-1 py-4 flex-1 space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-ink-subtle animate-pulse">
              Loading audit timeline...
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-xs text-red-400 space-y-2">
              <AlertCircle size={20} className="mx-auto" />
              <p>Failed to load audit logs.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-[11px] font-bold text-fuel-amber underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : !logs || logs.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-subtle italic">
              No recorded change events found for this record.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-hairline">
              {logs.map((log) => {
                const parsed = parseChanges(log.changes_json);
                const hasOldNew = parsed && typeof parsed === "object" && ("old" in parsed || "new" in parsed);

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-fuel-amber/20 border-2 border-fuel-amber group-hover:scale-125 transition-transform" />

                    <div className="bg-surface-2/80 border border-hairline rounded-lg p-3 space-y-2 text-xs">
                      {/* Action Header */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-ink flex items-center gap-1.5">
                          <Badge className="text-[9px] font-mono uppercase bg-fuel-amber/15 text-fuel-amber border-transparent">
                            {log.action}
                          </Badge>
                        </span>
                        <span className="text-[10px] text-ink-subtle flex items-center gap-1 font-mono">
                          <Clock size={11} />
                          {new Date(log.created_at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>

                      {/* Actor Information */}
                      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <User size={12} className="text-ink-subtle" />
                        <span>Performed by: <strong className="text-ink font-semibold">{log.actor_name || `User #${log.actor_id || "System"}`}</strong></span>
                      </div>

                      {/* Changes / Diff Details */}
                      {hasOldNew ? (
                        <div className="mt-2 pt-2 border-t border-hairline/60 grid grid-cols-2 gap-2 text-[11px] font-mono">
                          {parsed.old && (
                            <div className="bg-red-500/5 border border-red-500/15 p-2 rounded text-red-400">
                              <span className="block text-[9px] uppercase font-bold text-red-500 mb-1">Previous Values:</span>
                              <pre className="whitespace-pre-wrap font-sans text-[10px] leading-relaxed">
                                {JSON.stringify(parsed.old, null, 2)}
                              </pre>
                            </div>
                          )}
                          {parsed.new && (
                            <div className="bg-emerald-500/5 border border-emerald-500/15 p-2 rounded text-emerald-400">
                              <span className="block text-[9px] uppercase font-bold text-emerald-500 mb-1">New Values:</span>
                              <pre className="whitespace-pre-wrap font-sans text-[10px] leading-relaxed">
                                {JSON.stringify(parsed.new, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : parsed ? (
                        <div className="mt-2 pt-2 border-t border-hairline/60 bg-surface-3/50 p-2 rounded font-mono text-[10px] text-ink-muted">
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                            {typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : String(parsed)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
