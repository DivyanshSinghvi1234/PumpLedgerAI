import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import voucherService from "../services/voucherService";

export function useVerifyVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => voucherService.verifyVoucher(uuid),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["vouchers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });
      queryClient.invalidateQueries({
        queryKey: ["ledger"],
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      });

      toast.success("Voucher verified.");
    },

    onError: (err) => {
      toast.error(
        extractApiError(err, "Unable to verify voucher.")
      );
    },
  });
}
