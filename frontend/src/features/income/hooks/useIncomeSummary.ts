import { useQuery } from "@tanstack/react-query";

import incomeService from "../services/incomeService";

export function useIncomeSummary(onDate: string) {
  return useQuery({
    queryKey: ["income", "summary", onDate],
    queryFn: () => incomeService.getSummary(onDate),
    enabled: onDate.length > 0,
  });
}
