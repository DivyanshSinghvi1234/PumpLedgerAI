import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

interface Props
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;

  children: ReactNode;

  variant?: "primary" | "danger";
}

export default function LoadingButton({
  loading = false,
  children,
  variant = "primary",
  className = "",
  ...props
}: Props) {

  const colors =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-blue-600 hover:bg-blue-700";

  return (
    <button
      {...props}
      disabled={
        loading || props.disabled
      }
      className={`rounded-md px-4 py-2 text-white transition disabled:opacity-50 ${colors} ${className}`}
    >
      {loading
        ? "Please wait..."
        : children}
    </button>
  );
}