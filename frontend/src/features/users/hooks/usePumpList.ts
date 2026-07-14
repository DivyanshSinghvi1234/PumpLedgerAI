import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import type { Pump } from "@/features/auth/services/pump";

export function usePumpList() {
  return useQuery<Pump[]>({
    queryKey: ["pumps"],
    queryFn: async () => {
      const response = await api.get<Pump[]>("/v1/pumps");
      return response.data;
    },
  });
}
