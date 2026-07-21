import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import incomeService from "../services/incomeService";
import { extractApiError } from "@/api/client";

export function useCreateIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: incomeService.createIncome,

    onSuccess: () => {
      // A new income/expense row changes the list, the day's totals, and may
      // add a new category to the autocomplete. A lending expense linked to a
      // customer also moves that customer's outstanding balance / ledger.
      queryClient.invalidateQueries({ queryKey: ["income"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });

      toast.success("Saved.");
    },

    onError: (err: any) => {
      toast.error(extractApiError(err, "Unable to save."));
    },
  });
}
