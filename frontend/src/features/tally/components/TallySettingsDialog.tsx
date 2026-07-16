import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import FormInput from "@/components/forms/FormInput";
import FormActions from "@/components/forms/FormActions";
import {
  getStoredTallyMappings,
  getStoredTallyVoucherTypes,
} from "../hooks/useTally";
import type { TallyLedgerMappings, TallyVoucherTypes } from "../types";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  onSave(): void;
}

export default function TallySettingsDialog({
  open,
  onOpenChange,
  onSave,
}: Props) {
  const [mappings, setMappings] = useState<TallyLedgerMappings>(getStoredTallyMappings());
  const [vchTypes, setVchTypes] = useState<TallyVoucherTypes>(getStoredTallyVoucherTypes());

  useEffect(() => {
    if (open) {
      setMappings(getStoredTallyMappings());
      setVchTypes(getStoredTallyVoucherTypes());
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("tally_ledger_mappings", JSON.stringify(mappings));
    localStorage.setItem("tally_voucher_types", JSON.stringify(vchTypes));
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card p-6 shadow-xl">
        <DialogTitle className="text-xl font-semibold tracking-tight">
          Tally Integration Settings
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Configure the Tally Ledger and Voucher Type names exactly as they are defined in your Tally Company.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Voucher Type Names
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput
                label="Sales Voucher Type"
                required
                value={vchTypes.sales}
                onChange={(e) => setVchTypes({ ...vchTypes, sales: e.target.value })}
              />
              <FormInput
                label="Receipt Voucher Type"
                required
                value={vchTypes.receipt}
                onChange={(e) => setVchTypes({ ...vchTypes, receipt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Cash/Bank Ledgers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput
                label="Cash Ledger"
                required
                value={mappings.cash_ledger}
                onChange={(e) => setMappings({ ...mappings, cash_ledger: e.target.value })}
              />
              <FormInput
                label="UPI Ledger"
                required
                value={mappings.upi_ledger}
                onChange={(e) => setMappings({ ...mappings, upi_ledger: e.target.value })}
              />
              <FormInput
                label="Card Ledger"
                required
                value={mappings.card_ledger}
                onChange={(e) => setMappings({ ...mappings, card_ledger: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Revenue (Sales) Ledgers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput
                label="Petrol Sales"
                required
                value={mappings.petrol_sales_ledger}
                onChange={(e) => setMappings({ ...mappings, petrol_sales_ledger: e.target.value })}
              />
              <FormInput
                label="Diesel Sales"
                required
                value={mappings.diesel_sales_ledger}
                onChange={(e) => setMappings({ ...mappings, diesel_sales_ledger: e.target.value })}
              />
              <FormInput
                label="Lubricant Sales"
                required
                value={mappings.lubricant_sales_ledger}
                onChange={(e) => setMappings({ ...mappings, lubricant_sales_ledger: e.target.value })}
              />
            </div>
          </div>

          <FormActions
            submitLabel="Save Mappings"
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
