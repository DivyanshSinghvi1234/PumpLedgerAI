import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import VoucherForm from "./VoucherForm";

import { useCreateVoucher } from "../hooks/useCreateVoucher";
import { useUpdateVoucher } from "../hooks/useUpdateVoucher";

import type {
  CreateVoucherRequest,
  Voucher,
} from "@/types/voucher";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  voucher?: Voucher;
}

export default function VoucherDialog({
  open,
  onOpenChange,
  voucher,
}: Props) {
  const createMutation = useCreateVoucher();
  const updateMutation = useUpdateVoucher();

  const loading =
    createMutation.isPending ||
    updateMutation.isPending;

  async function handleSubmit(
    data: CreateVoucherRequest
  ) {
    try {
      if (voucher) {
        await updateMutation.mutateAsync({
          uuid: voucher.uuid,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }

      // Only close on success — a failed save (e.g. duplicate invoice)
      // keeps the dialog open; the hook shows the reason as a toast.
      onOpenChange(false);
    } catch {
      // Error already surfaced by the mutation's onError toast.
    }
  }

  useEffect(() => {
    if (!open) {
      createMutation.reset();
      updateMutation.reset();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-4xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          {voucher
            ? "Edit Voucher"
            : "New Voucher"}
        </DialogTitle>

        <VoucherForm
          loading={loading}
          defaultValues={
            voucher
              ? {
                  invoice_number:
                    voucher.invoice_number,
                  invoice_date:
                    voucher.invoice_date,
                  vehicle_number:
                    voucher.vehicle_number ?? "",
                  customer_name:
                    voucher.customer_name ?? "",
                  customer_uuid:
                    voucher.customer_uuid ?? "",
                  fuel_type: voucher.fuel_type,
                  quantity_liters:
                    voucher.quantity_liters,
                  rate_per_liter:
                    voucher.rate_per_liter,
                  total_amount:
                    voucher.total_amount,
                  payment_mode:
                    voucher.payment_mode,
                  remarks: voucher.remarks ?? "",
                }
              : undefined
          }
          onCancel={() =>
            onOpenChange(false)
          }
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
