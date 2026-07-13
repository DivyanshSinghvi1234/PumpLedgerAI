import { useMemo, useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import PaymentToolbar from "./components/PaymentToolbar";
import PaymentTable from "./components/PaymentTable";
import ReceivePaymentDialog from "./components/ReceivePaymentDialog";
import DeletePaymentDialog from "./components/DeletePaymentDialog";

import { usePaymentList } from "./hooks/usePaymentList";
import { useDeletePayment } from "./hooks/useDeletePayment";
import { useCustomerOptions } from "./hooks/useCustomerOptions";

import type { Payment } from "./types/payment";

export default function PaymentListPage() {
  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedPayment, setSelectedPayment] =
    useState<Payment>();

  const deleteMutation = useDeletePayment();

  const {
    data,
    isLoading,
    isError,
  } = usePaymentList({
    search,
    page,
    page_size: 20,
  });

  // Customer options power the receive-payment dropdown.
  const { data: customerData } =
    useCustomerOptions();

  const customerOptions = useMemo(
    () =>
      (customerData?.items ?? []).map(
        (customer) => ({
          label: customer.name,
          value: customer.uuid,
        })
      ),
    [customerData]
  );

  function handleCreate() {
    setDialogOpen(true);
  }

  function handleDelete(payment: Payment) {
    setSelectedPayment(payment);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedPayment) return;

    await deleteMutation.mutateAsync(
      selectedPayment.uuid
    );

    setDeleteOpen(false);
    setSelectedPayment(undefined);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <EmptyState message="Unable to load payments." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Receive and track customer payments."
      />

      <PaymentToolbar
        canCreate={canManage}
        onCreate={handleCreate}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      <PaymentTable
        payments={data?.items ?? []}
        canManage={canManage}
        onDelete={handleDelete}
      />

      <div className="flex items-center justify-end gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border border-border px-3 py-2 disabled:opacity-50"
        >
          Previous
        </button>

        <span>
          Page {page} of{" "}
          {data?.pagination.total_pages ?? 1}
        </span>

        <button
          disabled={
            page >=
            (data?.pagination.total_pages ?? 1)
          }
          onClick={() => setPage((p) => p + 1)}
          className="rounded border border-border px-3 py-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {canManage && (
        <>
          <ReceivePaymentDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            customerOptions={customerOptions}
          />

          <DeletePaymentDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            loading={deleteMutation.isPending}
            payment={selectedPayment}
            onConfirm={confirmDelete}
          />
        </>
      )}
    </div>
  );
}
