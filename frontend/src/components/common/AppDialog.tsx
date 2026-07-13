import type { ReactNode } from "react";

interface AppDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  children: ReactNode;
}

export default function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: AppDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">

      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">

        <div className="border-b px-6 py-4">

          <h2 className="text-xl font-semibold">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}

        </div>

        <div className="p-6">
          {children}
        </div>

        <div className="border-t px-6 py-3 flex justify-end">

          <button
            onClick={() => onOpenChange(false)}
            className="rounded border px-4 py-2"
          >
            Close
          </button>

        </div>

      </div>

    </div>
  );
}