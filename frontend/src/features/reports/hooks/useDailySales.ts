import { useQuery } from "@tanstack/react-query";

import reportService from "../services/reportService";

import type { DailySalesParams } from "../services/reportService";

export function useDailySales(
  params: DailySalesParams
) {
  return useQuery({
    queryKey: ["report", "daily-sales", params],

    queryFn: () =>
      reportService.dailySales(params),

    placeholderData: (previous) => previous,
  });
}
