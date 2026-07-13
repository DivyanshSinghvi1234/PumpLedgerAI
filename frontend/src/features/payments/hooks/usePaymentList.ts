import { useQuery } from "@tanstack/react-query";

import paymentService from "../services/paymentService";

import type { PaymentSearchParams } from "../services/paymentService";

export function usePaymentList(
  params: PaymentSearchParams
) {
  return useQuery({
    queryKey: [
      "payments",
      params,
    ],

    queryFn: () =>
      paymentService.getPayments(params),

    placeholderData: (previous) => previous,
  });
}
