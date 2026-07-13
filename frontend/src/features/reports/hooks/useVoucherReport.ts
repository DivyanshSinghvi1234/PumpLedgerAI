import { useQuery } from "@tanstack/react-query";

import reportService from "../services/reportService";

import type { VoucherReportParams } from "../services/reportService";

export function useVoucherReport(
  params: VoucherReportParams
) {
  return useQuery({
    queryKey: ["report", "vouchers", params],

    queryFn: () =>
      reportService.voucherReport(params),

    placeholderData: (previous) => previous,
  });
}
