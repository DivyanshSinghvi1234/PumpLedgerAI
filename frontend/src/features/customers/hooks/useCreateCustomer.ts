import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import customerService from "../services/customerService";

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: customerService.createCustomer,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });

      toast.success("Customer created.");
    },

    onError: (err) => {
      // Surface the real reason (duplicate mobile/GST/code, validation)
      // instead of failing silently.
      toast.error(extractApiError(err, "Unable to create customer."));
    },
  });
}