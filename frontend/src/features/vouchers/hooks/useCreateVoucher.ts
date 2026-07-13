import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import voucherService from "../services/voucherService";

export function useCreateVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: voucherService.createVoucher,

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

      toast.success("Voucher created.");
    },

    onError: (err) => {
      toast.error(
        extractApiError(err, "Unable to create voucher.")
      );
    },
  });
}
