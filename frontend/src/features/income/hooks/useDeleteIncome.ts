import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import incomeService from "../services/incomeService";

export function useDeleteIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uuid: string) => incomeService.deleteIncome(uuid),

    onSuccess: () => {
      // Deleting a loan (customer-linked expense) restores that customer's
      // balance, so refresh the customer/ledger views too.
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });

      toast.success("Entry deleted.");
    },

    onError: () => {
      toast.error("Unable to delete entry.");
    },
  });
}
