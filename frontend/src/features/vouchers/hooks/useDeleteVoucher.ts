import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import voucherService from "../services/voucherService";

export function useDeleteVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: voucherService.deleteVoucher,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vouchers"],
      });
      // A credit voucher affects the linked customer's balance/ledger.
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ledger"],
      });

      toast.success("Voucher deleted.");
    },

    onError: () => {
      toast.error("Unable to delete voucher.");
    },
  });
}
