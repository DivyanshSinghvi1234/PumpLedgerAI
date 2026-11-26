import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { pipelineService } from "../services/pipelineService";
import { Button } from "../../../components/ui/button";

interface Props {
  targetDate: string;
  onFixed?: () => void;
}

export function FivePointAuditBanner({ targetDate, onFixed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["five-point-audit", targetDate],
    queryFn: () => pipelineService.get5PointAudit(targetDate),
    refetchInterval: 30000,
  });

  const fixMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === "auto_balance_unbilled_cash") {
        return pipelineService.autoBalanceCash(targetDate);
      }
      if (action === "fix_customer_balances") {
        return pipelineService.recalculateBalances();
      }
      if (action === "fix_unlinked_bank_entries") {
        return pipelineService.fixLegacyEntries(undefined, targetDate);
      }
      return null;
    },
    onSuccess: (res) => {
      toast.success(res?.message || "Mismatch resolved automatically.");
      queryClient.invalidateQueries({ queryKey: ["five-point-audit", targetDate] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", targetDate] });
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", targetDate] });
      onFixed?.();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not apply auto-fix.");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="h-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 animate-pulse" />
    );
  }

  const ok = data.all_clear;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        ok
          ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
          : "border-amber-300 bg-amber-50/80 dark:border-amber-800/70 dark:bg-amber-950/25"
      }`}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          {ok ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div>
            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
              5-Point Auto-Audit: {ok ? "0 Issues" : `${data.mismatch_count} Mismatch${data.mismatch_count > 1 ? "es" : ""}`}
            </span>
            <span className="ml-2 text-xs text-slate-600 dark:text-slate-400 hidden sm:inline">
              Meters · Tank Dips · Cash Drawer · Customer Ledgers · Bank Links
            </span>
          </div>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1"
        >
          {expanded ? "Hide" : "Inspect"}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-4 py-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.checks.map((c) => {
            const isOk = c.status === "OK";
            return (
              <div
                key={c.id}
                className={`rounded-lg border p-2.5 text-xs flex flex-col justify-between gap-2 ${
                  isOk
                    ? "border-emerald-200/80 bg-white/70 dark:border-emerald-900/50 dark:bg-slate-900/50"
                    : "border-amber-300 bg-white dark:border-amber-800 dark:bg-slate-900"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 font-semibold text-slate-800 dark:text-slate-100">
                    <span>{c.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        isOk
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                      }`}
                    >
                      {isOk ? "OK" : "DRIFT"}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-400 leading-snug">
                    {c.message}
                  </p>
                </div>
                {!isOk && c.fix_action && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full border-amber-400 text-amber-800 hover:bg-amber-50 dark:text-amber-300"
                    disabled={fixMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      fixMutation.mutate(c.fix_action!);
                    }}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    {c.fix_label || "Fix in 1 Click"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
