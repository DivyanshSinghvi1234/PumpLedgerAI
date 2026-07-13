import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import vehicleService from "../services/vehicleService";

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: vehicleService.deleteVehicle,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vehicles"],
      });

      toast.success("Vehicle deleted.");
    },

    onError: () => {
      toast.error("Unable to delete vehicle.");
    },
  });
}
