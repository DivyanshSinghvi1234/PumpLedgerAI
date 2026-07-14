import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import paymentService from "../services/paymentService";

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentService.deletePayment,

    onSuccess: () => {
      // Reversing a payment restores the customer's balance.
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

      toast.success("Payment deleted.");
    },

    onError: () => {
      toast.error("Unable to delete payment.");
    },
  });
}
