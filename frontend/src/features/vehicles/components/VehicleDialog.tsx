import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import VehicleForm from "./VehicleForm";

import { useCreateVehicle } from "../hooks/useCreateVehicle";
import { useUpdateVehicle } from "../hooks/useUpdateVehicle";

import type {
  CreateVehicleRequest,
  Vehicle,
} from "../types/vehicle";

interface CustomerOption {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  vehicle?: Vehicle;
  customerOptions: CustomerOption[];
}

export default function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  customerOptions,
}: Props) {
  const createMutation = useCreateVehicle();
  const updateMutation = useUpdateVehicle();

  const loading =
    createMutation.isPending ||
    updateMutation.isPending;

  async function handleSubmit(
    data: CreateVehicleRequest
  ) {
    if (vehicle) {
      // Customer cannot be reassigned; the backend update
      // schema only accepts number/type/is_active.
      await updateMutation.mutateAsync({
        uuid: vehicle.uuid,
        data: {
          vehicle_number: data.vehicle_number,
          vehicle_type:
            data.vehicle_type || null,
        },
      });
    } else {
      await createMutation.mutateAsync(data);
    }

    onOpenChange(false);
  }

  useEffect(() => {
    if (!open) {
      createMutation.reset();
      updateMutation.reset();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-4xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          {vehicle
            ? "Edit Vehicle"
            : "New Vehicle"}
        </DialogTitle>

        <VehicleForm
          loading={loading}
          customerOptions={customerOptions}
          lockCustomer={Boolean(vehicle)}
          defaultValues={
            vehicle
              ? {
                  customer_uuid:
                    vehicle.customer_uuid,
                  customer_name:
                    vehicle.customer_name,
                  vehicle_number:
                    vehicle.vehicle_number,
                  vehicle_type:
                    vehicle.vehicle_type ?? "",
                }
              : undefined
          }
          onCancel={() =>
            onOpenChange(false)
          }
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
