import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import settingService from "@/features/settings/services/settingService";
import type { LubricantItem } from "@/features/inventory/components/LubricantsTab";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import TableExportButton from "@/components/common/TableExportButton";

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
import { PaymentModeBadge } from "@/components/common/PaymentModeBadge";
import { formatCurrency } from "@/lib/utils";

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
    return <LoadingState variant="table" />;
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
        action={
          <TableExportButton
            filename="vouchers"
            rows={data?.items ?? []}
            columns={[
              { header: "Invoice #", accessor: (v) => v.invoice_number },
              { header: "Date", accessor: (v) => v.invoice_date },
              { header: "Customer", accessor: (v) => v.customer_name },
              { header: "Vehicle", accessor: (v) => v.vehicle_number },
              { header: "Fuel", accessor: (v) => v.fuel_type },
              { header: "Liters", accessor: (v) => v.quantity_liters },
              { header: "Rate", accessor: (v) => v.rate_per_liter },
              { header: "Total Amount", accessor: (v) => v.total_amount },
              { header: "Payment Mode", accessor: (v) => v.payment_mode },
              { header: "Status", accessor: (v) => v.verification_status },
            ]}
          />
        }
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
                {(search || selectedFuelTypes.length > 0 || selectedPaymentModes.length > 0 || selectedStatuses.length > 0 || paymentStatusFilter || fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedFuelTypes([]);
                      setSelectedPaymentModes([]);
                      setSelectedStatuses([]);
                      setPaymentStatusFilter(undefined);
                      setFromDate("");
                      setToDate("");
                      setPage(1);
                    }}
                    className="px-3 py-1 rounded-full text-xs font-semibold border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                  >
                    Clear Filters ×
                  </button>
                )}
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2.5">
        {(data?.items ?? []).map((v) => (
          <div key={v.uuid} className="rounded-xl border border-hairline bg-surface-1 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-ink">#{v.invoice_number}</span>
              <PaymentModeBadge mode={v.payment_mode} />
            </div>
            <div className="flex items-center justify-between text-ink-muted">
              <span>{v.customer_name || v.vehicle_number || "Walk-in"}</span>
              <span className="font-mono">{v.invoice_date}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-hairline">
              <span className="font-mono font-bold text-sm text-ink">{formatCurrency(v.total_amount)}</span>
              <div className="flex items-center gap-1.5">
                {canManage && v.payment_status !== "PAID" && (
                  <button type="button" onClick={() => setSettleVoucher(v)} className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-500 font-semibold">Settle</button>
                )}
                {canManage && (
                  <button type="button" onClick={() => handleRepeat(v)} className="px-2 py-1 rounded bg-surface-2 border border-hairline text-ink-muted">Repeat</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-xl border border-hairline bg-surface-1 overflow-hidden shadow-md">
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
