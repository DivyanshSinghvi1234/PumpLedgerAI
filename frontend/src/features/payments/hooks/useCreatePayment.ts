import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import paymentService from "../services/paymentService";

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentService.createPayment,

    onSuccess: () => {
      // A payment changes both the payment list and the
      // customer's outstanding balance.
      queryClient.invalidateQueries({
        queryKey: ["payments"],
      });
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["customer"],
      });
      queryClient.invalidateQueries({
        queryKey: ["vouchers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ledger"],
      });

      toast.success("Payment recorded.");
    },

    onError: () => {
      toast.error("Unable to record payment.");
    },
  });
}
