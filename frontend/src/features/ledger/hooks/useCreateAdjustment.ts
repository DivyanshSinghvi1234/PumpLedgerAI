import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import ledgerService from "../services/ledgerService";

import type { CreateAdjustmentRequest } from "../types/ledger";

export function useCreateAdjustment(
  customerUuid: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAdjustmentRequest) =>
      ledgerService.createAdjustment(
        customerUuid,
        data
      ),

    onSuccess: () => {
      // An adjustment changes the ledger and the customer's balance.
      queryClient.invalidateQueries({
        queryKey: ["ledger", customerUuid],
      });
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });

      toast.success("Adjustment posted.");
    },

    onError: () => {
      toast.error("Unable to post adjustment.");
    },
  });
}
