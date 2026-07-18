import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import vehicleService from "../services/vehicleService";

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: vehicleService.createVehicle,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vehicles"],
      });
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });

      toast.success("Vehicle created.");
    },

    onError: (err) => {
      toast.error(extractApiError(err, "Unable to create vehicle."));
    },
  });
}
