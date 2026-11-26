import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import settingService from "@/features/settings/services/settingService";
import type { LubricantItem } from "@/features/inventory/components/LubricantsTab";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import VoucherToolbar from "./components/VoucherToolbar";
import VoucherTable from "./components/VoucherTable";
import VoucherPagination from "./components/VoucherPagination";
import VoucherDialog from "./components/VoucherDialog";
import DeleteVoucherDialog from "./components/DeleteVoucherDialog";
import SettleVoucherDialog from "./components/SettleVoucherDialog";

import { useVoucherList } from "./hooks/useVoucherList";
import { useDeleteVoucher } from "./hooks/useDeleteVoucher";

import type { Voucher } from "@/types/voucher";

export default function VoucherListPage() {
  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([]);
  const [selectedPaymentModes, setSelectedPaymentModes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [settleVoucher, setSettleVoucher] = useState<Voucher | null>(null);

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
      selectedFuelTypes.length > 0
        ? selectedFuelTypes.join(",")
        : undefined,

    payment_mode:
      selectedPaymentModes.length > 0
        ? selectedPaymentModes.join(",")
        : undefined,

    verification_status:
      selectedStatuses.length > 0
        ? selectedStatuses.join(",")
        : undefined,

    from_date: fromDate || undefined,
    to_date: toDate || undefined,

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

    const deletedVoucher = selectedVoucher;
    await deleteMutation.mutateAsync(
      deletedVoucher.uuid
    );

    if (deletedVoucher.fuel_type === "LUBRICANT") {
      try {
        const items = await settingService.getSetting<LubricantItem[]>("lubricant_inventory");
        if (items && items.length > 0) {
          const qty = Number(deletedVoucher.quantity_liters || 0);
          const rate = Number(deletedVoucher.rate_per_liter || 0);
          const remarks = (deletedVoucher.remarks || "").toLowerCase();
          const idx = items.findIndex(
            (s) =>
              (remarks && remarks.includes(s.name.toLowerCase())) ||
              (rate > 0 && Math.abs(s.unit_price - rate) < 0.01)
          );
          if (idx >= 0 && qty > 0) {
            const updated = items.map((s, i) =>
              i === idx ? { ...s, stock_qty: s.stock_qty + qty } : s
            );
            await settingService.saveSetting("lubricant_inventory", updated);
            queryClient.invalidateQueries({ queryKey: ["settings", "lubricant_inventory"] });
          }
        }
      } catch {
        // non-blocking
      }
    }

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
        selectedFuelTypes={selectedFuelTypes}
        selectedPaymentModes={selectedPaymentModes}
        selectedStatuses={selectedStatuses}
        fromDate={fromDate}
        toDate={toDate}
        onFuelTypesChange={(values) => {
          setSelectedFuelTypes(values);
          setPage(1);
        }}
        onPaymentModesChange={(values) => {
          setSelectedPaymentModes(values);
          setPage(1);
        }}
        onStatusesChange={(values) => {
          setSelectedStatuses(values);
          setPage(1);
        }}
        onFromDateChange={(value) => {
          setFromDate(value);
          setPage(1);
        }}
        onToDateChange={(value) => {
          setToDate(value);
          setPage(1);
        }}
      />

      <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden shadow-md">
        <VoucherTable
          vouchers={data?.items ?? []}
          canManage={canManage}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSettle={(v) => setSettleVoucher(v)}
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

          <SettleVoucherDialog
            voucher={settleVoucher}
            onOpenChange={(o) => !o && setSettleVoucher(null)}
          />
        </>
      )}

    </div>
  );
}
