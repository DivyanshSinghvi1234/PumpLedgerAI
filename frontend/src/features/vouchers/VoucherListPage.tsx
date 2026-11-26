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
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | undefined>(undefined);
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

    payment_status: paymentStatusFilter,

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

  function handleRepeat(voucher: Voucher) {
    const todayStr = new Date().toISOString().split("T")[0];
    setSelectedVoucher({
      ...voucher,
      uuid: "",
      invoice_number: "",
      invoice_date: todayStr,
      quantity_liters: 0,
      total_amount: 0,
    });
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

      {/* 1-Tap Quick Filter Pills + Live Summary Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(() => {
            const todayStr = new Date().toISOString().split("T")[0];
            const isToday = fromDate === todayStr && toDate === todayStr;
            const isUnpaid = paymentStatusFilter === "UNPAID";
            const isCash = selectedPaymentModes.length === 1 && selectedPaymentModes[0] === "CASH";
            const isUpi = selectedPaymentModes.length === 1 && selectedPaymentModes[0] === "UPI";
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (isToday) { setFromDate(""); setToDate(""); }
                    else { setFromDate(todayStr); setToDate(todayStr); }
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
                    isToday ? "bg-fuel-amber text-canvas border-fuel-amber" : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatusFilter(isUnpaid ? undefined : "UNPAID");
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
                    isUnpaid ? "bg-rose-500 text-white border-rose-500" : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
                  }`}
                >
                  Unpaid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaymentModes(isCash ? [] : ["CASH"]);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
                    isCash ? "bg-emerald-600 text-white border-emerald-600" : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaymentModes(isUpi ? [] : ["UPI"]);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
                    isUpi ? "bg-indigo-600 text-white border-indigo-600" : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
                  }`}
                >
                  UPI
                </button>
              </>
            );
          })()}
        </div>

        {/* Live Summary Strip */}
        {data?.items && data.items.length > 0 && (() => {
          const sumMode = (m: string) =>
            data.items.filter((v) => v.payment_mode === m).reduce((s, v) => s + Number(v.total_amount || 0), 0);
          const unpaidSum = data.items
            .filter((v) => v.payment_status !== "PAID")
            .reduce((s, v) => s + Number(v.balance_due ?? v.total_amount ?? 0), 0);
          return (
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono bg-surface-1 border border-hairline rounded-lg px-3 py-1.5">
              <span>Cash: <strong>₹{sumMode("CASH").toLocaleString("en-IN")}</strong></span>
              <span>UPI: <strong>₹{sumMode("UPI").toLocaleString("en-IN")}</strong></span>
              <span>Bank: <strong>₹{sumMode("BANK").toLocaleString("en-IN")}</strong></span>
              <span>Credit: <strong>₹{sumMode("CREDIT").toLocaleString("en-IN")}</strong></span>
              <span className="text-rose-500">Unpaid: <strong>₹{unpaidSum.toLocaleString("en-IN")}</strong></span>
            </div>
          );
        })()}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden shadow-md">
        <VoucherTable
          vouchers={data?.items ?? []}
          canManage={canManage}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSettle={(v) => setSettleVoucher(v)}
          onRepeat={handleRepeat}
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
