import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import voucherService from "@/features/vouchers/services/voucherService";
import type { CreateVoucherRequest } from "@/types/voucher";

/**
 * Record a fuel sale that has no printed bill. This is just a Voucher under the
 * hood — the existing voucher flow already supports multiple fuel items, a
 * customer link, and posts to the customer ledger — so a no-bill sale reuses it
 * rather than duplicating that logic. The caller supplies an auto-generated
 * invoice number (see NoBillSaleDialog).
 */
export function useCreateNoBillSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVoucherRequest) =>
      voucherService.createVoucher(data),

    onSuccess: () => {
      // A no-bill sale is a voucher that also moves the customer's balance and
      // the day's sales figures, so refresh all of those views.
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["income"] });

      toast.success("Sale recorded.");
    },

    onError: () => {
      toast.error("Unable to record sale.");
    },
  });
}
