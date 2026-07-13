import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import customerService from "../services/customerService";

import type { UpdateCustomerRequest } from "../types/customer";

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uuid,
      data,
    }: {
      uuid: string;
      data: UpdateCustomerRequest;
    }) =>
      customerService.updateCustomer(
        uuid,
        data
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["customers"],
      });

      toast.success("Customer updated.");
    },

    onError: (err) => {
      toast.error(
        extractApiError(err, "Unable to update customer.")
      );
    },
  });
}