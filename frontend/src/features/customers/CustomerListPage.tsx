import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/api/client";
import { getWhatsAppShareUrl } from "@/lib/whatsapp";
import { formatCurrency } from "@/lib/utils";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import CustomerToolbar from "./components/CustomerToolbar";
import CustomerTable from "./components/CustomerTable";
import CustomerDialog from "./components/CustomerDialog";
import DeleteCustomerDialog from "./components/DeleteCustomerDialog";

import { useCustomerList } from "./hooks/useCustomerList";
import { useDeleteCustomer } from "./hooks/useDeleteCustomer";

import type { Customer } from "./types/customer";

import { MessageCircle, GitMerge, ShieldAlert } from "lucide-react";
import WhatsAppDigestDialog from "./components/WhatsAppDigestDialog";

export default function CustomerListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer>();

  const deleteMutation = useDeleteCustomer();

  const { data: riskScores = [] } = useQuery({
    queryKey: ["customer-risk-scores"],
    queryFn: async () => {
      const res = await api.get("/v1/customers/risk-scores");
      return res.data as Array<{
        customer_uuid: string;
        name: string;
        mobile: string | null;
        outstanding_balance: number;
        credit_limit: number;
        overdue_days: number;
        risk_score: "RED" | "AMBER" | "GREEN";
        collection_stage: "SOFT_HOLD" | "DAY_15_REMINDER" | "CURRENT";
      }>;
    },
  });

  const { data: duplicates = [] } = useQuery({
    queryKey: ["customer-duplicates"],
    queryFn: async () => {
      const res = await api.get("/v1/customers/duplicates");
      return res.data as Array<{
        key: string;
        customers: Array<{ uuid: string; name: string; mobile: string | null; outstanding_balance: number }>;
      }>;
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ source_uuid, target_uuid }: { source_uuid: string; target_uuid: string }) => {
      const res = await api.post("/v1/customers/merge", { source_uuid, target_uuid });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(`Merged into ${res.target_name}.`);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["customer-risk-scores"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Merge failed."),
  });

  const {
    data,
    isLoading,
    isError,
  } = useCustomerList({
    search,
    page,
    page_size: 20,
  });

  function handleCreate() {
    setSelectedCustomer(undefined);
    setDialogOpen(true);
  }

  function handleEdit(customer: Customer) {
    setSelectedCustomer(customer);
    setDialogOpen(true);
  }

  function handleDelete(customer: Customer) {
    setSelectedCustomer(customer);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedCustomer) return;

    await deleteMutation.mutateAsync(
      selectedCustomer.uuid
    );

    setDeleteOpen(false);
    setSelectedCustomer(undefined);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <EmptyState message="Unable to load customers." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage petrol pump customers."
        action={
          <button
            onClick={() => setDigestOpen(true)}
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3.5 py-2 cursor-pointer transition-colors flex items-center gap-2 text-xs font-bold"
          >
            <MessageCircle size={16} />
            Monthly WhatsApp Digest
          </button>
        }
      />


      <CustomerToolbar
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onCreate={handleCreate}
      />

      {/* Duplicate Customers Auto-Detector */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs space-y-2">
          <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <GitMerge size={14} /> Possible Duplicate Customers Detected ({duplicates.length})
          </div>
          <div className="space-y-1.5">
            {duplicates.slice(0, 3).map((grp) => {
              const primary = grp.customers[0];
              const dup = grp.customers[1];
              return (
                <div key={grp.key} className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-500/20 bg-surface-1 px-3 py-1.5">
                  <span>
                    <strong>{primary.name}</strong> ({formatCurrency(primary.outstanding_balance)}) ↔{" "}
                    <strong>{dup.name}</strong> ({formatCurrency(dup.outstanding_balance)})
                  </span>
                  <button
                    type="button"
                    disabled={mergeMutation.isPending}
                    onClick={() => mergeMutation.mutate({ source_uuid: dup.uuid, target_uuid: primary.uuid })}
                    className="rounded bg-fuel-amber px-2.5 py-1 text-[11px] font-semibold text-canvas hover:bg-fuel-amber/90 cursor-pointer disabled:opacity-50"
                  >
                    Merge into {primary.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority Follow-Up Strip (Red / Amber Risk & Collection Score) */}
      {riskScores.some((r) => r.risk_score !== "GREEN") && (
        <div className="rounded-xl border border-hairline bg-surface-1 p-3.5 text-xs space-y-2">
          <div className="font-bold text-ink flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-rose-500" />
            Credit Collection Priority (Day 15 Reminder / Day 30 Soft Hold)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {riskScores
              .filter((r) => r.risk_score !== "GREEN")
              .slice(0, 6)
              .map((r) => (
                <div
                  key={r.customer_uuid}
                  className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 ${
                    r.risk_score === "RED"
                      ? "border-rose-500/40 bg-rose-500/10"
                      : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      onClick={() => navigate(`/dashboard/customers/${r.customer_uuid}/ledger`)}
                      className="font-semibold text-ink truncate hover:underline cursor-pointer"
                    >
                      {r.name}
                    </div>
                    <div className="text-[11px] text-ink-muted">
                      {r.overdue_days}d overdue · {r.collection_stage === "SOFT_HOLD" ? "SOFT HOLD" : "Day 15 Reminder"}
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="font-mono font-bold text-ink">{formatCurrency(r.outstanding_balance)}</div>
                    <button
                      type="button"
                      onClick={() => {
                        const msg =
                          r.collection_stage === "SOFT_HOLD"
                            ? `Urgent: Dear ${r.name}, your account balance of ${formatCurrency(r.outstanding_balance)} is overdue by ${r.overdue_days} days. Credit is on soft hold until payment.`
                            : `Gentle Reminder: Dear ${r.name}, your fuel bill balance of ${formatCurrency(r.outstanding_balance)} is pending (${r.overdue_days} days).`;
                        window.open(getWhatsAppShareUrl(r.mobile, msg), "_blank");
                      }}
                      className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <CustomerTable
        customers={data?.items ?? []}
        onViewLedger={(customer) =>
          navigate(
            `/dashboard/customers/${customer.uuid}/ledger`
          )
        }
        onEdit={handleEdit}
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

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={selectedCustomer}
      />

      <DeleteCustomerDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        loading={deleteMutation.isPending}
        customer={selectedCustomer}
        onConfirm={confirmDelete}
      />

      <WhatsAppDigestDialog
        open={digestOpen}
        onOpenChange={setDigestOpen}
      />
    </div>
  );
}