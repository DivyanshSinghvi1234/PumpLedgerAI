import api from "@/api/client";
import type {
  FuelTank,
  FuelTankCreate,
  DipReading,
  DipReadingCreate,
  PriceSchedule,
  PriceScheduleCreate,
  FuelType,
} from "../types";

class InventoryService {
  async getTanks(): Promise<FuelTank[]> {
    const response = await api.get<FuelTank[]>("/v1/tanks");
    return response.data;
  }

  async createTank(data: FuelTankCreate): Promise<FuelTank> {
    const response = await api.post<FuelTank>("/v1/tanks", data);
    return response.data;
  }

  async getDips(): Promise<DipReading[]> {
    const response = await api.get<DipReading[]>("/v1/tanks/dips");
    return response.data;
  }

  async postDipReading(tankUuid: string, data: DipReadingCreate): Promise<DipReading> {
    const response = await api.post<DipReading>(`/v1/tanks/${tankUuid}/dips`, data);
    return response.data;
  }

  async createPriceSchedule(data: PriceScheduleCreate): Promise<PriceSchedule> {
    const response = await api.post<PriceSchedule>("/v1/price-schedules", data);
    return response.data;
  }

  async getActiveRate(fuelType: FuelType): Promise<{ fuel_type: FuelType; rate: number }> {
    const response = await api.get<{ fuel_type: FuelType; rate: number }>(
      "/v1/price-schedules/active-rate",
      {
        params: { fuel_type: fuelType },
      }
    );
    return response.data;
  }
}

const inventoryService = new InventoryService();
export default inventoryService;
