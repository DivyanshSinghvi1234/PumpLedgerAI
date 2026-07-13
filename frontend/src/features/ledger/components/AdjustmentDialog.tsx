import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import AdjustmentForm from "./AdjustmentForm";

import { useCreateAdjustment } from "../hooks/useCreateAdjustment";

import type { CreateAdjustmentRequest } from "../types/ledger";

interface Props {
  open: boolean;
  customerUuid: string;
  onOpenChange(open: boolean): void;
}

export default function AdjustmentDialog({
  open,
  customerUuid,
  onOpenChange,
}: Props) {
  const createMutation =
    useCreateAdjustment(customerUuid);

  async function handleSubmit(
    data: CreateAdjustmentRequest
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
      <DialogContent className="max-w-xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          Post Adjustment
        </DialogTitle>

        <AdjustmentForm
          loading={createMutation.isPending}
          onCancel={() =>
            onOpenChange(false)
          }
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
