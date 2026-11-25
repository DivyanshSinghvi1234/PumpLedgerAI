import { AlertTriangle, Sparkles, CheckCircle2 } from "lucide-react";
import type {
  FuzzyCustomerCandidate,
  VoucherSuggestionResponse,
} from "@/types/voucher";

interface Props {
  suggestion: VoucherSuggestionResponse | null;
  autoAppliedNotes?: string[];
  onPickFuzzyCustomer?: (candidate: FuzzyCustomerCandidate) => void;
}

export default function VoucherSuggestionBanner({
  suggestion,
  autoAppliedNotes = [],
  onPickFuzzyCustomer,
}: Props) {
  if (!suggestion) return null;

  const hasWarnings = suggestion.warnings.length > 0;
  const hasStats =
    suggestion.vehicle_uuid &&
    suggestion.vehicle_sample_count > 0 &&
    suggestion.vehicle_avg_quantity !== null;

  if (!hasWarnings && autoAppliedNotes.length === 0 && !hasStats) {
    return null;
  }

  return (
    <div className="space-y-2">
      {(autoAppliedNotes.length > 0 || hasStats) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">Smart Auto-Fill:</span>
          {autoAppliedNotes.map((note, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 font-medium"
            >
              <CheckCircle2 className="h-3 w-3" /> {note}
            </span>
          ))}
          {hasStats && (
            <span className="text-emerald-700/80 dark:text-emerald-300/80">
              Vehicle avg: {suggestion.vehicle_avg_quantity} L ({suggestion.vehicle_sample_count} fills)
            </span>
          )}
        </div>
      )}

      {suggestion.warnings.map((w, idx) => (
        <div
          key={`${w.type}-${idx}`}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
            <div className="space-y-1.5 flex-1">
              <p className="font-medium">{w.message}</p>
              {w.type === "FUZZY_CUSTOMER_MATCH" && w.candidates.length > 0 && onPickFuzzyCustomer && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] opacity-80">Apply match:</span>
                  {w.candidates.map((cand) => (
                    <button
                      key={cand.customer_uuid}
                      type="button"
                      onClick={() => onPickFuzzyCustomer(cand)}
                      className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer"
                    >
                      {cand.customer_name} ({Math.round(cand.score * 100)}%)
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
