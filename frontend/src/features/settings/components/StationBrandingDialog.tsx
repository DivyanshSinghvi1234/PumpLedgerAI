import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import FormInput from "@/components/forms/FormInput";
import FormTextarea from "@/components/forms/FormTextarea";
import FormActions from "@/components/forms/FormActions";
import settingService from "../services/settingService";

export interface StationBranding {
  station_name?: string;
  gstin?: string;
  tagline?: string;
  phone?: string;
  address?: string;
  print_terms?: string;
  footer_notes?: string;
}

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  defaultStationName?: string;
}

export default function StationBrandingDialog({
  open,
  onOpenChange,
  defaultStationName = "Fuel Station",
}: Props) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<StationBranding>({
    station_name: defaultStationName,
    gstin: "",
    tagline: "Quality & Quantity Guaranteed",
    phone: "",
    address: "",
    print_terms: "1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.",
    footer_notes: "Thank you for your business! Please drive safely.",
  });

  const { data: savedBranding } = useQuery({
    queryKey: ["settings", "station_branding"],
    queryFn: () => settingService.getSetting<StationBranding>("station_branding"),
    enabled: open,
  });

  useEffect(() => {
    if (savedBranding) {
      setForm((prev) => ({ ...prev, ...savedBranding }));
    }
  }, [savedBranding]);

  const saveMutation = useMutation({
    mutationFn: (updated: StationBranding) =>
      settingService.saveSetting("station_branding", updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "station_branding"] });
      toast.success("Station branding updated successfully!");
      onOpenChange(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast.error("Failed to save station branding.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-xl font-semibold tracking-tight">
          Custom Station Branding
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          Configure fuel station header details, GSTIN, and custom disclaimers printed on receipts and ledger statements.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormInput
            label="Station Name"
            value={form.station_name || ""}
            onChange={(e) => setForm({ ...form, station_name: e.target.value })}
            placeholder="e.g. Vichaxan Fuel Station"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="GSTIN Number"
              value={form.gstin || ""}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              placeholder="e.g. 08AAAAA0000A1Z5"
            />
            <FormInput
              label="Phone / Mobile"
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          <FormInput
            label="Header Tagline"
            value={form.tagline || ""}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            placeholder="e.g. Quality & Quantity Guaranteed"
          />

          <FormInput
            label="Station Address"
            value={form.address || ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="e.g. Main Highway, District ABC"
          />

          <FormTextarea
            label="Print Terms & Conditions"
            value={form.print_terms || ""}
            onChange={(e) => setForm({ ...form, print_terms: e.target.value })}
            rows={3}
          />

          <FormInput
            label="Footer Note"
            value={form.footer_notes || ""}
            onChange={(e) => setForm({ ...form, footer_notes: e.target.value })}
            placeholder="e.g. Thank you for your business!"
          />

          <FormActions
            onCancel={() => onOpenChange(false)}
            submitLabel="Save Branding"
            loading={saveMutation.isPending}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
