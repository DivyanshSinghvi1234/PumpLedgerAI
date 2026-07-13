import { useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import VoucherToolbar from "./components/VoucherToolbar";
import VoucherTable from "./components/VoucherTable";
import VoucherPagination from "./components/VoucherPagination";
import VoucherDialog from "./components/VoucherDialog";
import DeleteVoucherDialog from "./components/DeleteVoucherDialog";

import { useVoucherList } from "./hooks/useVoucherList";
import { useDeleteVoucher } from "./hooks/useDeleteVoucher";

import type { Voucher } from "@/types/voucher";

export default function VoucherListPage() {
  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [search, setSearch] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedVoucher, setSelectedVoucher] =
    useState<Voucher>();

  const deleteMutation = useDeleteVoucher();

  const {
    data,
    isLoading,
    isError,
  } = useVoucherList({
    search,

    fuel_type:
      fuelType === "ALL"
        ? undefined
        : fuelType,

    payment_mode:
      paymentMode === "ALL"
        ? undefined
        : paymentMode,

    page,

    page_size: 20,
  });

  function handleCreate() {
    setSelectedVoucher(undefined);
    setDialogOpen(true);
  }

  function handleEdit(voucher: Voucher) {
    setSelectedVoucher(voucher);
    setDialogOpen(true);
  }

  function handleDelete(voucher: Voucher) {
    setSelectedVoucher(voucher);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedVoucher) return;

    await deleteMutation.mutateAsync(
      selectedVoucher.uuid
    );

    setDeleteOpen(false);
    setSelectedVoucher(undefined);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <EmptyState
        message="Unable to load vouchers."
      />
    );
  }

  return (
    <div className="space-y-6">

      <PageHeader
        title="Vouchers"
        description="Manage all fuel vouchers."
      />

      <VoucherToolbar
        canCreate={canManage}
        onCreate={handleCreate}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onFuelChange={(value) => {
          setFuelType(value);
          setPage(1);
        }}
        onPaymentChange={(value) => {
          setPaymentMode(value);
          setPage(1);
        }}
      />

      <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden shadow-md">
        <VoucherTable
          vouchers={data?.items ?? []}
          canManage={canManage}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <VoucherPagination
        page={page}
        totalPages={
          data?.pagination.total_pages ?? 1
        }
        onPageChange={setPage}
      />

      {canManage && (
        <>
          <VoucherDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            voucher={selectedVoucher}
          />

          <DeleteVoucherDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            loading={deleteMutation.isPending}
            voucher={selectedVoucher}
            onConfirm={confirmDelete}
          />
        </>
      )}

    </div>
  );
}
