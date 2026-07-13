import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import vehicleService from "../services/vehicleService";

import type { UpdateVehicleRequest } from "../types/vehicle";

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uuid,
      data,
    }: {
      uuid: string;
      data: UpdateVehicleRequest;
    }) =>
      vehicleService.updateVehicle(
        uuid,
        data
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vehicles"],
      });

      toast.success("Vehicle updated.");
    },

    onError: () => {
      toast.error("Unable to update vehicle.");
    },
  });
}
