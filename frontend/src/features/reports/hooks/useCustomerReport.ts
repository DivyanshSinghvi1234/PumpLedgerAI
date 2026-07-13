import { useQuery } from "@tanstack/react-query";

import reportService from "../services/reportService";

export function useCustomerReport(
  search: string
) {
  return useQuery({
    queryKey: ["report", "customers", search],

    queryFn: () =>
      reportService.customerReport(search),

    placeholderData: (previous) => previous,
  });
}
