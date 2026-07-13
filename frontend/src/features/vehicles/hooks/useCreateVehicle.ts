import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import vehicleService from "../services/vehicleService";

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: vehicleService.createVehicle,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vehicles"],
      });

      toast.success("Vehicle created.");
    },

    onError: () => {
      toast.error("Unable to create vehicle.");
    },
  });
}
