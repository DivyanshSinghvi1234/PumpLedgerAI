import { useQuery } from "@tanstack/react-query";

import customerService from "@/features/customers/services/customerService";

/**
 * Fetch a flat list of customers for the payment customer selector.
 * Payments must attach to a real customer to update their balance.
 */
export function useCustomerOptions() {
  return useQuery({
    queryKey: ["customers", "options"],

    queryFn: () =>
      customerService.getCustomers({
        page: 1,
        page_size: 1000,
      }),
  });
}
