import VehicleActions from "./VehicleActions";

import type { Vehicle } from "../types/vehicle";

interface Props {
  vehicles: Vehicle[];
  canManage?: boolean;
  onEdit(vehicle: Vehicle): void;
  onDelete(vehicle: Vehicle): void;
}

export default function VehicleTable({
  vehicles,
  canManage = true,
  onEdit,
  onDelete,
}: Props) {

  if (vehicles.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        No vehicles found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vehicle Number
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </th>

            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer
            </th>

            {canManage && (
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {vehicles.map((vehicle) => (
            <tr
              key={vehicle.uuid}
              className="border-t border-border"
            >
              <td className="px-4 py-3 font-medium">
                {vehicle.vehicle_number}
              </td>

              <td className="px-4 py-3">
                {vehicle.vehicle_type ?? "-"}
              </td>

              <td className="px-4 py-3">
                {vehicle.customer_name}
              </td>

              {canManage && (
                <td className="px-4 py-3">
                  <VehicleActions
                    onEdit={() =>
                      onEdit(vehicle)
                    }
                    onDelete={() =>
                      onDelete(vehicle)
                    }
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
