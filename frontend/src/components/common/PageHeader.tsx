import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  helpText?: string;
  action?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  helpText,
  action,
}: PageHeaderProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="mb-6 font-sans space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {title}
            </h1>
            {helpText && (
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-muted hover:text-ink hover:border-fuel-amber/40 transition cursor-pointer"
                title="How this page works"
              >
                <HelpCircle size={12} className="text-fuel-amber" />
                <span>Guide</span>
              </button>
            )}
          </div>

          {description && (
            <p className="mt-1 text-sm text-ink-muted">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {helpText && showHelp && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-fuel-amber/30 bg-fuel-amber/5 px-3.5 py-2.5 text-xs text-ink-muted">
          <p className="leading-relaxed">{helpText}</p>
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="text-ink-subtle hover:text-ink cursor-pointer shrink-0 mt-0.5"
            aria-label="Close guide"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}