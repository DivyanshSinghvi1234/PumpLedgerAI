import { useState } from "react";
import { useParams, Link } from "react-router-dom";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

import LedgerSummary from "./components/LedgerSummary";
import LedgerTable from "./components/LedgerTable";
import AdjustmentDialog from "./components/AdjustmentDialog";
import CustomerVehicleVouchers from "./components/CustomerVehicleVouchers";

import { useCustomerLedger } from "./hooks/useCustomerLedger";

export default function CustomerLedgerPage() {
  const { customerUuid = "" } = useParams();

  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    data,
    isLoading,
    isError,
  } = useCustomerLedger(customerUuid, {
    page,
    page_size: 20,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    return (
      <EmptyState message="Unable to load ledger." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ledger — ${data.customer_name}`}
        description="Customer account statement."
        action={
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/customers"
              className="rounded-md border px-4 py-2"
            >
              Back
            </Link>

            {canManage && (
              <button
                onClick={() =>
                  setDialogOpen(true)
                }
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              >
                + Adjustment
              </button>
            )}
          </div>
        }
      />

      <LedgerSummary
        customerName={data.customer_name}
        openingBalance={data.opening_balance}
        closingBalance={data.closing_balance}
      />

      <LedgerTable entries={data.items} />

      <CustomerVehicleVouchers customerUuid={customerUuid} />

      <div className="flex items-center justify-end gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded border px-3 py-2 disabled:opacity-50"
        >
          Previous
        </button>

        <span>
          Page {page} of{" "}
          {data.pagination.total_pages}
        </span>

        <button
          disabled={
            page >= data.pagination.total_pages
          }
          onClick={() => setPage((p) => p + 1)}
          className="rounded border px-3 py-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {canManage && (
        <AdjustmentDialog
          open={dialogOpen}
          customerUuid={customerUuid}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
