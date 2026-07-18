import { useMemo } from "react";
import VehicleActions from "./VehicleActions";
import type { Vehicle } from "../types/vehicle";

interface Props {
  vehicles: Vehicle[];
  canManage?: boolean;
  onViewLedger(vehicle: Vehicle): void;
  onEdit(vehicle: Vehicle): void;
  onDelete(vehicle: Vehicle): void;
}

interface CustomerGroup {
  customerUuid: string | null;
  customerName: string;
  vehicles: Vehicle[];
  totalOutstanding: number;
}

export default function VehicleTable({
  vehicles,
  canManage = true,
  onViewLedger,
  onEdit,
  onDelete,
}: Props) {
  const groups = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();

    for (const v of vehicles) {
      const key = v.customer_uuid || v.customer_name || "unassigned";
      const name = v.customer_name || "Unassigned Customer";
      const balance = Number(v.outstanding_balance ?? 0);

      const existing = map.get(key);
      if (existing) {
        existing.vehicles.push(v);
        existing.totalOutstanding += balance;
      } else {
        map.set(key, {
          customerUuid: v.customer_uuid || null,
          customerName: name,
          vehicles: [v],
          totalOutstanding: balance,
        });
      }
    }

    return [...map.values()].sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    );
  }, [vehicles]);

  if (vehicles.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        No vehicles found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div
          key={group.customerUuid ?? group.customerName}
          className="rounded-xl border border-border bg-card overflow-hidden shadow-sm"
        >
          {/* Customer Group Box Header */}
          <div className="flex flex-wrap items-center justify-between bg-muted/60 px-5 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-foreground">
                {group.customerName}
              </span>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {group.vehicles.length}{" "}
                {group.vehicles.length === 1 ? "Vehicle" : "Vehicles"}
              </span>
            </div>

            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 font-mono">
              Total Outstanding: ₹
              {group.totalOutstanding.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>

          {/* Vehicles List Table for this Customer */}
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-background/40">
                <tr className="text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-5 py-2.5 text-left font-medium">
                    Vehicle Number
                  </th>
                  <th className="px-5 py-2.5 text-left font-medium">Type</th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    Outstanding
                  </th>
                  {canManage && (
                    <th className="px-5 py-2.5 text-center font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {group.vehicles.map((vehicle) => (
                  <tr
                    key={vehicle.uuid}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-sm">
                      {vehicle.vehicle_number}
                    </td>

                    <td className="px-5 py-3 text-sm text-muted-foreground">
                      {vehicle.vehicle_type ?? "-"}
                    </td>

                    <td className="px-5 py-3 text-right font-medium text-sm font-mono">
                      ₹
                      {Number(
                        vehicle.outstanding_balance ?? 0
                      ).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {canManage && (
                      <td className="px-5 py-3 text-center">
                        <VehicleActions
                          onViewLedger={() => onViewLedger(vehicle)}
                          onEdit={() => onEdit(vehicle)}
                          onDelete={() => onDelete(vehicle)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
