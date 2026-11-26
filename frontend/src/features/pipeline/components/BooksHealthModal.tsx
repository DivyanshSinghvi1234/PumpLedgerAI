import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HeartPulse, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import { pipelineService } from "../services/pipelineService";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

export function BooksHealthCard() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["books-health"],
    queryFn: () => pipelineService.getBooksHealth(),
  });

  const fixMutation = useMutation({
    mutationFn: async (action: string) => {
      if (action === "fix_legacy_entries") {
        return pipelineService.fixLegacyEntries();
      }
      if (action === "fix_customer_balances") {
        return pipelineService.recalculateBalances();
      }
      return null;
    },
    onSuccess: (res) => {
      toast.success(
        res?.fixed_count !== undefined
          ? `Fixed ${res.fixed_count} record(s).`
          : "Books health issue resolved."
      );
      queryClient.invalidateQueries({ queryKey: ["books-health"] });
      queryClient.invalidateQueries({ queryKey: ["five-point-audit"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to run 1-click fix.");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-rose-500" />
          Books Health Check
        </CardTitle>
        {data && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              data.total_issues === 0
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {data.total_issues === 0 ? "Clean Books" : `${data.total_issues} Gap(s)`}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {isLoading || !data ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : (
          data.issues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                {issue.count === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {issue.title}
                  </div>
                  <div className="text-slate-500">
                    {issue.count === 0 ? "No issues detected" : `${issue.count} record(s) found`}
                  </div>
                </div>
              </div>
              {issue.count > 0 && issue.fix_action && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  disabled={fixMutation.isPending}
                  onClick={() => fixMutation.mutate(issue.fix_action!)}
                >
                  <Wrench className="h-3 w-3 mr-1" />
                  Fix in 1 Click
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
