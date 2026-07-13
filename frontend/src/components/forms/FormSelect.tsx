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
    <div className="space-y-1">

      <label className="text-sm font-medium">
        {label}
      </label>

      <select
        {...props}
        className={`w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-sm text-red-500">
          {error}
        </p>
      )}

    </div>
  );
}