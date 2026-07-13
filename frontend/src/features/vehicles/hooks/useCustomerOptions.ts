import { useQuery } from "@tanstack/react-query";

import customerService from "@/features/customers/services/customerService";

/**
 * Fetch a flat list of customers for use in selectors and name lookups.
 * Vehicles belong to a customer, so several vehicle screens need this.
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
