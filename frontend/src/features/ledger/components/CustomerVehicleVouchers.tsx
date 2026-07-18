import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useVoucherList } from "@/features/vouchers/hooks/useVoucherList";
import { VoucherPaymentStatusBadge } from "@/features/vouchers/components/VoucherStatusBadge";
import { formatCurrency } from "@/lib/utils";

import type { Voucher } from "@/types/voucher";

interface Props {
  customerUuid: string;
}

// A bucket of vouchers sharing a vehicle (or the "no vehicle" bucket).
interface VehicleGroup {
  vehicleNumber: string | null;
  vehicleUuid: string | null;
  vouchers: Voucher[];
  outstanding: number;
}

const NO_VEHICLE = "__none__";

/**
 * Lists a customer's vouchers grouped by vehicle. Vouchers with no vehicle fall
 * into a "General" bucket. Each group header links to that vehicle's dedicated
 * ledger where available. This complements the running-balance statement above
 * by showing what's owed per vehicle.
 */
export default function CustomerVehicleVouchers({
  customerUuid,
}: Props) {
  const [open, setOpen] = useState(true);

  const { data, isLoading } = useVoucherList({
    customer_uuid: customerUuid,
    page: 1,
    page_size: 100,
    sort_by: "invoice_date",
    sort_order: "desc",
  });

  const groups = useMemo<VehicleGroup[]>(() => {
    const items = data?.items ?? [];

    const byVehicle = new Map<string, VehicleGroup>();

    for (const voucher of items) {
      const key = voucher.vehicle_number?.trim() || NO_VEHICLE;

      const existing = byVehicle.get(key);

      if (existing) {
        existing.vouchers.push(voucher);
        existing.outstanding += Number(voucher.balance_due) || 0;
      } else {
        byVehicle.set(key, {
          vehicleNumber:
            key === NO_VEHICLE ? null : voucher.vehicle_number,
          vehicleUuid:
            key === NO_VEHICLE ? null : voucher.vehicle_uuid,
          vouchers: [voucher],
          outstanding: Number(voucher.balance_due) || 0,
        });
      }
    }

    // Named vehicles first (alphabetical), the "General" bucket last.
    return [...byVehicle.values()].sort((a, b) => {
      if (a.vehicleNumber === null) return 1;
      if (b.vehicleNumber === null) return -1;
      return a.vehicleNumber.localeCompare(b.vehicleNumber);
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Loading vehicle breakdown…
      </div>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold">
          Vouchers by Vehicle ({groups.length})
        </span>
        <span className="text-muted-foreground">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open &&
        groups.map((group) => (
          <div
            key={group.vehicleNumber ?? NO_VEHICLE}
            className="overflow-hidden rounded-lg border border-border"
          >
            <div className="flex items-center justify-between bg-muted px-4 py-2.5">
              {group.vehicleUuid ? (
                <Link
                  to={`/dashboard/vehicles/${group.vehicleUuid}/ledger`}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  {group.vehicleNumber}
                </Link>
              ) : (
                <span className="text-sm font-semibold">
                  {group.vehicleNumber ?? "General (no vehicle)"}
                </span>
              )}

              <span className="text-sm font-medium text-blue-600">
                Outstanding: {formatCurrency(group.outstanding)}
              </span>
            </div>

            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left">Invoice</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Fuel</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                  <th className="px-4 py-2 text-center">Status</th>
                </tr>
              </thead>

              <tbody>
                {group.vouchers.map((v) => (
                  <tr
                    key={v.uuid}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2 font-medium">
                      {v.invoice_number}
                    </td>
                    <td className="px-4 py-2">{v.invoice_date}</td>
                    <td className="px-4 py-2">{v.fuel_type}</td>
                    <td className="px-4 py-2 text-right">
                      {formatCurrency(v.total_amount)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {formatCurrency(v.balance_due)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <VoucherPaymentStatusBadge
                        status={v.payment_status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
