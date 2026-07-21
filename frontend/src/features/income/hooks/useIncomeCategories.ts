import { useQuery } from "@tanstack/react-query";

import incomeService from "../services/incomeService";

/** Previously-used category names, powering the datalist autocomplete. */
export function useIncomeCategories() {
  return useQuery({
    queryKey: ["income", "categories"],
    queryFn: () => incomeService.getCategories(),
    staleTime: 60_000,
  });
}
