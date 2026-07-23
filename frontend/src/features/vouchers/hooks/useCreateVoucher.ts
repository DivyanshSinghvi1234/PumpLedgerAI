import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import voucherService from "../services/voucherService";
import { enqueueOfflineTransaction } from "@/lib/offlineQueue";
import type { CreateVoucherRequest } from "@/types/voucher";

export function useCreateVoucher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVoucherRequest) => {
      // If client is explicitly offline, enqueue directly without waiting for HTTP timeout
      if (!navigator.onLine) {
        enqueueOfflineTransaction(
          "VOUCHER",
          "/v1/vouchers",
          data,
          `Credit Voucher #${data.invoice_number || "Draft"}`
        );
        return { isOfflineQueued: true };
      }

      try {
        return await voucherService.createVoucher(data);
      } catch (err: any) {
        // Fallback for network disconnects, gateway timeouts (502/503/504), or CORS/offline errors
        const isNetworkErr = !err.response || err.code === "ERR_NETWORK" || err.response.status >= 500;
        if (isNetworkErr) {
          enqueueOfflineTransaction(
            "VOUCHER",
            "/v1/vouchers",
            data,
            `Credit Voucher #${data.invoice_number || "Draft"}`
          );
          return { isOfflineQueued: true };
        }
        throw err;
      }
    },

    onSuccess: (result) => {
      if (result && (result as any).isOfflineQueued) {
        toast.info("Saved offline! Voucher queued for auto-sync.");
        return;
      }

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
