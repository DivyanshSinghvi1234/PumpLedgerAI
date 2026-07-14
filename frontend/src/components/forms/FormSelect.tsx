import type { SelectHTMLAttributes } from "react";

interface Option {
  label: string;
  value: string;
}

interface Props
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  error?: string;
}

export default function FormSelect({
  label,
  options,
  error,
  className = "",
  ...props
}: Props) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
        {label}
      </label>

      <select
        {...props}
        className={`w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20 cursor-pointer ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs font-medium text-error">{error}</p>
      )}
    </div>
  );
}
