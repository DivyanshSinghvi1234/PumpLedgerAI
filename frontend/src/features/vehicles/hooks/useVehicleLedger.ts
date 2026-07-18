import { useQuery } from "@tanstack/react-query";

import vehicleService from "../services/vehicleService";

export function useVehicleLedger(
  vehicleUuid: string
) {
  return useQuery({
    queryKey: [
      "vehicle-ledger",
      vehicleUuid,
    ],

    queryFn: () =>
      vehicleService.getVehicleLedger(vehicleUuid),

    enabled: Boolean(vehicleUuid),

    placeholderData: (previous) => previous,
  });
}
