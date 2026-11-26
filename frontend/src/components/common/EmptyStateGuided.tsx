import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

interface StepItem {
  title: string;
  description: string;
  to?: string;
}

interface Props {
  title: string;
  subtitle: string;
  steps: StepItem[];
}

export function EmptyStateGuided({ title, subtitle, steps }: Props) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-1 p-6 text-center space-y-5">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-fuel-amber/15 text-fuel-amber">
        <Sparkles size={20} />
      </div>
      <div>
        <h3 className="text-base font-bold text-ink">{title}</h3>
        <p className="text-xs text-ink-muted mt-1">{subtitle}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
        {steps.map((s, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-hairline bg-surface-2 p-3.5 flex flex-col justify-between gap-2"
          >
            <div>
              <div className="text-[10px] font-mono font-bold text-fuel-amber uppercase">
                Step {idx + 1}
              </div>
              <div className="text-xs font-bold text-ink mt-0.5">{s.title}</div>
              <p className="text-[11px] text-ink-muted mt-1">{s.description}</p>
            </div>
            {s.to && (
              <Link
                to={s.to}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-fuel-amber hover:underline"
              >
                Go <ArrowRight size={11} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
