import { useQuery } from "@tanstack/react-query";

import vehicleService from "../services/vehicleService";

import type { VehicleSearchParams } from "../services/vehicleService";

export function useVehicleList(
  params: VehicleSearchParams
) {
  return useQuery({
    queryKey: [
      "vehicles",
      params,
    ],

    queryFn: () =>
      vehicleService.getVehicles(params),

    placeholderData: (previous) => previous,
  });
}
