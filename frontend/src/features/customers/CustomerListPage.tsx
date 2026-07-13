import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

export default function CustomerListPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer>();

  const deleteMutation = useDeleteCustomer();

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
      />

      <CustomerToolbar
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onCreate={handleCreate}
      />

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
    </div>
  );
}