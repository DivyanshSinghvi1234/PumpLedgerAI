import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import tallyService from "../services/tallyService";
import settingService from "@/features/settings/services/settingService";
import type { TallyExportRequest, TallyMarkSyncedRequest, TallyLedgerMappings, TallyVoucherTypes } from "../types";

export const DEFAULT_TALLY_MAPPINGS: TallyLedgerMappings = {
  cash_ledger: "Cash",
  upi_ledger: "Bank (UPI)",
  card_ledger: "Bank (Card)",
  petrol_sales_ledger: "Petrol Sales",
  diesel_sales_ledger: "Diesel Sales",
  lubricant_sales_ledger: "Lubricant Sales",
  petrol_stock_item: "M.S. (Petrol)",
  diesel_stock_item: "H.S.D. (Diesel)",
  lubricant_stock_item: "Lubricants",
  petrol_supplier_ledger: "Oil Company A/c",
  diesel_supplier_ledger: "Oil Company A/c",
  lubricant_supplier_ledger: "Lube Supplier A/c",
};

export const DEFAULT_TALLY_VOUCHER_TYPES: TallyVoucherTypes = {
  sales: "Sales",
  receipt: "Receipt",
  contra: "Contra",
  purchase: "Purchase",
};

export function getStoredTallyMappings(): TallyLedgerMappings {
  const stored = localStorage.getItem("tally_ledger_mappings");
  return stored ? JSON.parse(stored) : DEFAULT_TALLY_MAPPINGS;
}

export function getStoredTallyVoucherTypes(): TallyVoucherTypes {
  const stored = localStorage.getItem("tally_voucher_types");
  return stored ? JSON.parse(stored) : DEFAULT_TALLY_VOUCHER_TYPES;
}

export function saveStoredTallyMappings(mappings: TallyLedgerMappings) {
  localStorage.setItem("tally_ledger_mappings", JSON.stringify(mappings));
  settingService.saveSetting("tally_ledger_mappings", mappings).catch((err) => {
    console.error("Failed to sync Tally mappings to backend:", err);
  });
}

export function saveStoredTallyVoucherTypes(types: TallyVoucherTypes) {
  localStorage.setItem("tally_voucher_types", JSON.stringify(types));
  settingService.saveSetting("tally_voucher_types", types).catch((err) => {
    console.error("Failed to sync Tally voucher types to backend:", err);
  });
}

export function useTallySettings() {
  const query = useQuery({
    queryKey: ["settings", "tally"],
    queryFn: async () => {
      const [backendMappings, backendVoucherTypes] = await Promise.all([
        settingService.getSetting<TallyLedgerMappings>("tally_ledger_mappings"),
        settingService.getSetting<TallyVoucherTypes>("tally_voucher_types"),
      ]);

      const mappings = backendMappings || getStoredTallyMappings();
      const voucherTypes = backendVoucherTypes || getStoredTallyVoucherTypes();

      localStorage.setItem("tally_ledger_mappings", JSON.stringify(mappings));
      localStorage.setItem("tally_voucher_types", JSON.stringify(voucherTypes));

      return { mappings, voucherTypes };
    },
  });

  return query;
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
