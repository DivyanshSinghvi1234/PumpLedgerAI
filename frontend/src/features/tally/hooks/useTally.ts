import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import tallyService from "../services/tallyService";
import type { TallyExportRequest, TallyMarkSyncedRequest, TallyLedgerMappings, TallyVoucherTypes } from "../types";

export const DEFAULT_TALLY_MAPPINGS: TallyLedgerMappings = {
  cash_ledger: "Cash",
  upi_ledger: "Bank (UPI)",
  card_ledger: "Bank (Card)",
  petrol_sales_ledger: "Petrol Sales",
  diesel_sales_ledger: "Diesel Sales",
  lubricant_sales_ledger: "Lubricant Sales",
};

export const DEFAULT_TALLY_VOUCHER_TYPES: TallyVoucherTypes = {
  sales: "Sales",
  receipt: "Receipt",
};

export function getStoredTallyMappings(): TallyLedgerMappings {
  const stored = localStorage.getItem("tally_ledger_mappings");
  return stored ? JSON.parse(stored) : DEFAULT_TALLY_MAPPINGS;
}

export function getStoredTallyVoucherTypes(): TallyVoucherTypes {
  const stored = localStorage.getItem("tally_voucher_types");
  return stored ? JSON.parse(stored) : DEFAULT_TALLY_VOUCHER_TYPES;
}

export function useTallyPreview(request: TallyExportRequest, enabled: boolean = true) {
  return useQuery({
    queryKey: ["tally", "preview", request],
    queryFn: () => tallyService.previewExport(request),
    enabled,
  });
}

export function useExportTally() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TallyExportRequest) => tallyService.downloadExportXml(request),
    onSuccess: (_, variables) => {
      if (variables.mark_as_synced) {
        queryClient.invalidateQueries({ queryKey: ["tally"] });
        queryClient.invalidateQueries({ queryKey: ["vouchers"] });
        queryClient.invalidateQueries({ queryKey: ["payments"] });
      }
      toast.success("Tally XML file generated successfully.");
    },
    onError: (error: any) => {
      console.error(error);
      toast.error("Failed to generate Tally XML.");
    },
  });
}

export function useMarkTallySynced() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: TallyMarkSyncedRequest) => tallyService.markAsSynced(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tally"] });
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Selected items marked as synced.");
    },
    onError: () => {
      toast.error("Failed to mark items as synced.");
    },
  });
}
