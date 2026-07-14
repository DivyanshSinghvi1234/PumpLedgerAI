import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Vehicle } from "../types/vehicle";

interface Props {
  open: boolean;
  vehicle?: Vehicle;
  loading?: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(): void;
}

export default function DeleteVehicleDialog({
  open,
  vehicle,
  loading = false,
  onOpenChange,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card p-6 shadow-xl">
        <DialogTitle className="mb-4 text-xl font-semibold">
          Delete Vehicle
        </DialogTitle>

        <p className="text-ink-muted">
          Are you sure you want to delete
        </p>
        <p className="mt-1 font-semibold text-ink">
          {vehicle?.vehicle_number}?
        </p>
        <p className="mt-4 text-sm text-error">
          This action cannot be undone.
        </p>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-error px-4 py-2.5 text-sm font-bold text-canvas hover:bg-error/90 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
