import { useQuery } from "@tanstack/react-query";

import reportService from "../services/reportService";

export function useLedgerReport(
  customerUuid: string,
  params: { from_date?: string; to_date?: string }
) {
  return useQuery({
    queryKey: [
      "report",
      "ledger",
      customerUuid,
      params,
    ],

    queryFn: () =>
      reportService.ledgerReport(
        customerUuid,
        params
      ),

    enabled: Boolean(customerUuid),

    placeholderData: (previous) => previous,
  });
}
