import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import VehicleToolbar from "./components/VehicleToolbar";
import VehicleTable from "./components/VehicleTable";
import VehicleDialog from "./components/VehicleDialog";
import DeleteVehicleDialog from "./components/DeleteVehicleDialog";

import { useVehicleList } from "./hooks/useVehicleList";
import { useDeleteVehicle } from "./hooks/useDeleteVehicle";
import { useCustomerOptions } from "./hooks/useCustomerOptions";

import type { Vehicle } from "./types/vehicle";

export default function VehicleListPage() {
  const navigate = useNavigate();

  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [selectedVehicle, setSelectedVehicle] =
    useState<Vehicle>();

  const deleteMutation = useDeleteVehicle();

  const {
    data,
    isLoading,
    isError,
  } = useVehicleList({
    search,
    page,
    page_size: 20,
  });

  // Customer options power the create/edit dialog dropdown.
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
    setSelectedVehicle(undefined);
    setDialogOpen(true);
  }

  function handleViewLedger(vehicle: Vehicle) {
    navigate(`/dashboard/vehicles/${vehicle.uuid}/ledger`);
  }

  function handleEdit(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setDialogOpen(true);
  }

  function handleDelete(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!selectedVehicle) return;

    await deleteMutation.mutateAsync(
      selectedVehicle.uuid
    );

    setDeleteOpen(false);
    setSelectedVehicle(undefined);
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <EmptyState message="Unable to load vehicles." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        description="Manage customer vehicles."
      />

      <VehicleToolbar
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onCreate={handleCreate}
        canCreate={canManage}
      />

      <VehicleTable
        vehicles={data?.items ?? []}
        canManage={canManage}
        onViewLedger={handleViewLedger}
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

      {canManage && (
        <>
          <VehicleDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            vehicle={selectedVehicle}
            customerOptions={customerOptions}
          />

          <DeleteVehicleDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            loading={deleteMutation.isPending}
            vehicle={selectedVehicle}
            onConfirm={confirmDelete}
          />
        </>
      )}
    </div>
  );
}
