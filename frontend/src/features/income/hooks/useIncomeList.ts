import { useQuery } from "@tanstack/react-query";

import incomeService, {
  type IncomeSearchParams,
} from "../services/incomeService";

export function useIncomeList(params: IncomeSearchParams) {
  return useQuery({
    queryKey: ["income", "list", params],
    queryFn: () => incomeService.getIncomes(params),
  });
}
