import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Clock, CreditCard } from "lucide-react";
import { pipelineService } from "../services/pipelineService";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

interface Props {
  targetDate: string;
}

export function CashBankTimelineCard({ targetDate }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-timeline", targetDate],
    queryFn: () => pipelineService.getTimeline(targetDate),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" />
            Live Cash & Bank Flow Timeline
          </span>
          {data && (
            <span className="text-xs font-normal text-slate-500">
              {data.count} event(s) on {data.date}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-9 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-9 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : !data || data.events.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No cash or bank movements recorded for {targetDate}.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {data.events.map((ev) => (
              <div
                key={ev.id}
                className="py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {ev.direction === "IN" ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : ev.direction === "OUT" ? (
                    <ArrowUpRight className="h-4 w-4 text-rose-500 shrink-0" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <div className="truncate">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {ev.title}
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {ev.mode}
                      </span>
                    </div>
                    {ev.subtitle && (
                      <div className="text-slate-500 truncate">{ev.subtitle}</div>
                    )}
                  </div>
                </div>
                <div
                  className={`font-semibold tabular-nums shrink-0 ${
                    ev.direction === "IN"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : ev.direction === "OUT"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {ev.direction === "OUT" ? "−" : "+"}₹
                  {ev.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
