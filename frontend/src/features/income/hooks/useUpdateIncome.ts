import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import incomeService from "../services/incomeService";
import { extractApiError } from "@/api/client";
import type { CreateIncomeRequest } from "../types/income";

export function useUpdateIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: CreateIncomeRequest }) =>
      incomeService.updateIncome(uuid, data),

    onSuccess: () => {
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
