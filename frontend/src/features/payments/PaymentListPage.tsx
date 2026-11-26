import { useMemo, useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import PaymentToolbar from "./components/PaymentToolbar";
import PaymentTable from "./components/PaymentTable";
import ReceivePaymentDialog from "./components/ReceivePaymentDialog";
import BulkPaymentDialog from "./components/BulkPaymentDialog";
import DeletePaymentDialog from "./components/DeletePaymentDialog";

import { usePaymentList } from "./hooks/usePaymentList";
import { useDeletePayment } from "./hooks/useDeletePayment";
import { useCustomerOptions } from "./hooks/useCustomerOptions";

import type { Payment } from "./types/payment";

export default function PaymentListPage() {
  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [search, setSearch] = useState("");
  const [quickMode, setQuickMode] = useState<string | undefined>(undefined);
  const [quickToday, setQuickToday] = useState(false);
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedPayment, setSelectedPayment] =
    useState<Payment>();

  const deleteMutation = useDeletePayment();

  const todayStr = new Date().toISOString().split("T")[0];
  const {
    data,
    isLoading,
    isError,
  } = usePaymentList({
    search,
    payment_mode: quickMode,
    payment_date: quickToday ? todayStr : undefined,
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
        onBulkCreate={() => setBulkOpen(true)}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {/* 1-Tap Quick Filter Pills + Live Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => { setQuickToday((v) => !v); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
              quickToday ? "bg-fuel-amber text-canvas border-fuel-amber" : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
            }`}
          >
            Today
          </button>
          {(["CASH", "UPI", "BANK", "SPLIT"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setQuickMode(quickMode === m ? undefined : m); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
                quickMode === m ? "bg-emerald-600 text-white border-emerald-600" : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {data?.items && data.items.length > 0 && (() => {
          const sumMode = (m: string) =>
            data.items.filter((p) => p.payment_mode === m).reduce((s, p) => s + Number(p.amount || 0), 0);
          const totalAll = data.items.reduce((s, p) => s + Number(p.amount || 0), 0);
          return (
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono bg-surface-1 border border-hairline rounded-lg px-3 py-1.5">
              <span>Cash: <strong>₹{sumMode("CASH").toLocaleString("en-IN")}</strong></span>
              <span>UPI: <strong>₹{sumMode("UPI").toLocaleString("en-IN")}</strong></span>
              <span>Bank: <strong>₹{sumMode("BANK").toLocaleString("en-IN")}</strong></span>
              <span className="text-emerald-500">Total: <strong>₹{totalAll.toLocaleString("en-IN")}</strong></span>
            </div>
          );
        })()}
      </div>

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

          <BulkPaymentDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
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
