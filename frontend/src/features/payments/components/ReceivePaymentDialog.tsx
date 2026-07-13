import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import PaymentForm from "./PaymentForm";

import { useCreatePayment } from "../hooks/useCreatePayment";

import type { CreatePaymentRequest } from "../types/payment";

interface CustomerOption {
  label: string;
  value: string;
}

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  customerOptions: CustomerOption[];
}

export default function ReceivePaymentDialog({
  open,
  onOpenChange,
  customerOptions,
}: Props) {
  const createMutation = useCreatePayment();

  async function handleSubmit(
    data: CreatePaymentRequest
  ) {
    await createMutation.mutateAsync(data);

    onOpenChange(false);
  }

  useEffect(() => {
    if (!open) {
      createMutation.reset();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-3xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          Receive Payment
        </DialogTitle>

        <PaymentForm
          loading={createMutation.isPending}
          customerOptions={customerOptions}
          onCancel={() =>
            onOpenChange(false)
          }
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
