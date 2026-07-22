import { useQuery } from "@tanstack/react-query";

import reportService from "../services/reportService";

export function useDebtorAging(asOf?: string) {
  return useQuery({
    queryKey: ["report", "debtor-aging", asOf ?? ""],

    queryFn: () => reportService.debtorAging(asOf),

    placeholderData: (previous) => previous,
  });
}
