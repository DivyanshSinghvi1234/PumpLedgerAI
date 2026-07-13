import { useQuery } from "@tanstack/react-query";

import customerService from "../services/customerService";

import type {
  CustomerSearchParams,
} from "../services/customerService";

export function useCustomerList(
  params: CustomerSearchParams
) {
  return useQuery({
    queryKey: [
      "customers",
      params,
    ],

    queryFn: () =>
      customerService.getCustomers(
        params
      ),

    placeholderData: (previous) =>
      previous,
  });
}