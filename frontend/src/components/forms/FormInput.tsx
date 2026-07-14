import type { InputHTMLAttributes } from "react";

interface Props
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
}

export default function FormInput({
  label,
  error,
  required,
  className = "",
  ...props
}: Props) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </label>

      <input
        {...props}
        className={`w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-tertiary focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20 ${className}`}
      />

      {error && (
        <p className="text-xs font-medium text-error">{error}</p>
      )}
    </div>
  );
}
