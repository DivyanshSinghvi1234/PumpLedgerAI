import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import CustomerForm from "./CustomerForm";

import { useCreateCustomer } from "../hooks/useCreateCustomer";
import { useUpdateCustomer } from "../hooks/useUpdateCustomer";

import type {
  CreateCustomerRequest,
  Customer,
} from "../types/customer";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  customer?: Customer;
}

export default function CustomerDialog({
  open,
  onOpenChange,
  customer,
}: Props) {
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const loading =
    createMutation.isPending ||
    updateMutation.isPending;

  async function handleSubmit(
    data: CreateCustomerRequest
  ) {
    try {
      if (customer) {
        await updateMutation.mutateAsync({
          uuid: customer.uuid,
          data,
        });
      } else {
        await createMutation.mutateAsync(data);
      }

      // Only close on success — a failed save keeps the dialog open so the
      // user can fix the input (the hook shows the real error as a toast).
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
      <DialogContent className="max-w-3xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          {customer
            ? "Edit Customer"
            : "New Customer"}
        </DialogTitle>

        <CustomerForm
          loading={loading}
          defaultValues={
            customer
              ? {
                  customer_code:
                    customer.customer_code ?? "",
                  name: customer.name,
                  mobile: customer.mobile ?? "",
                  email: customer.email ?? "",
                  gst_number:
                    customer.gst_number ?? "",
                  address: customer.address ?? "",
                  city: customer.city ?? "",
                  state: customer.state ?? "",
                  pincode: customer.pincode ?? "",
                  credit_limit:
                    customer.credit_limit,
                  opening_balance:
                    customer.opening_balance,
                  remarks: customer.remarks ?? "",
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