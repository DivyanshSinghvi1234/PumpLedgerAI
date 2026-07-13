import { useQuery } from "@tanstack/react-query";

import ledgerService from "../services/ledgerService";

import type { LedgerSearchParams } from "../services/ledgerService";

export function useCustomerLedger(
  customerUuid: string,
  params: LedgerSearchParams
) {
  return useQuery({
    queryKey: [
      "ledger",
      customerUuid,
      params,
    ],

    queryFn: () =>
      ledgerService.getLedger(
        customerUuid,
        params
      ),

    enabled: Boolean(customerUuid),

    placeholderData: (previous) => previous,
  });
}
