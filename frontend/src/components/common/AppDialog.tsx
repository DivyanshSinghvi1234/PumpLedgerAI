import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card p-6 shadow-xl">
        <DialogTitle className="text-xl font-semibold">
          {title}
        </DialogTitle>

        {description && (
          <p className="mt-1 text-sm text-ink-muted">
            {description}
          </p>
        )}

        <div className="mt-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
