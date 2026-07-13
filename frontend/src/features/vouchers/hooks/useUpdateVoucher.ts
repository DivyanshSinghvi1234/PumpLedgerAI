import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import voucherService from "../services/voucherService";

import type { UpdateVoucherRequest } from "@/types/voucher";

export function useUpdateVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uuid,
      data,
    }: {
      uuid: string;
      data: UpdateVoucherRequest;
    }) =>
      voucherService.updateVoucher(
        uuid,
        data
      ),

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

      toast.success("Voucher updated.");
    },

    onError: (err) => {
      toast.error(
        extractApiError(err, "Unable to update voucher.")
      );
    },
  });
}
