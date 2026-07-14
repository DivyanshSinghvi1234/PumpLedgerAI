import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { Calendar } from "lucide-react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

export default function FormDatePicker({
  label,
  error,
  required,
  className = "",
  id,
  ...props
}: Props) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const handleIconClick = () => {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-sm font-medium">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id={inputId}
          type="date"
          {...props}
          className={`w-full rounded-md border px-10 py-2 outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        />
        <Calendar
          size={16}
          onClick={handleIconClick}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}