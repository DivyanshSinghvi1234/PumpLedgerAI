import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border border-hairline sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
            <AlertTriangle
              size={18}
              className={variant === "danger" ? "text-rose-500 shrink-0" : "text-fuel-amber shrink-0"}
            />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-muted leading-relaxed pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs h-9 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => onConfirm()}
            className={`text-xs h-9 font-bold cursor-pointer ${
              variant === "danger"
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-fuel-amber hover:bg-fuel-amber/90 text-canvas"
            }`}
          >
            {loading ? "Please wait..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
