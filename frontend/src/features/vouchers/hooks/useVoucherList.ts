import { useQuery } from "@tanstack/react-query";

import voucherService from "../services/voucherService";

  import type {
    VoucherSearchParams,
} from "../services/voucherService";

export function useVoucherList(
  params: VoucherSearchParams
) {
  return useQuery({
    queryKey: [
      "vouchers",
      params,
    ],

    queryFn: () =>
      voucherService.getVouchers(
        params
      ),

    placeholderData: (previous) => previous,
  });
}