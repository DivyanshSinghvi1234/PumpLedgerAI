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
  if (!open || !vehicle) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">

        <h2 className="text-xl font-semibold">
          Delete Vehicle
        </h2>

        <p className="mt-4">
          Are you sure you want to delete
        </p>

        <p className="mt-1 font-semibold">
          {vehicle.vehicle_number}?
        </p>

        <p className="mt-4 text-sm text-red-600">
          This action cannot be undone.
        </p>

        <div className="mt-8 flex justify-end gap-3">

          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-md bg-destructive px-4 py-2 text-white hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading
              ? "Deleting..."
              : "Delete"}
          </button>

        </div>

      </div>
    </div>
  );
}
