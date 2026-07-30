import api from "@/api/client";
import type {
  FuelTank,
  FuelTankCreate,
  DipReading,
  DipReadingCreate,
  PriceSchedule,
  PriceScheduleCreate,
  FuelType,
  Nozzle,
  NozzleCreate,
  NozzleReading,
  FuelDispenser,
  FuelDispenserCreate,
  BulkNozzleReadingCreate,
  BulkFormResponse,
  TankerDelivery,
  TankerDeliveryCreate,
  FuelTankForecast,
  TankTransfer,
  TankTransferCreate,
  PurchaseIndent,
  PurchaseIndentCreate,
  PurchaseIndentStatusUpdate,
  IndentStatus,
} from "../types";



class InventoryService {
  async getTanks(): Promise<FuelTank[]> {
    const response = await api.get<FuelTank[]>("/v1/tanks");
    return response.data;
  }

  async getTankForecasts(): Promise<FuelTankForecast[]> {
    const response = await api.get<FuelTankForecast[]>("/v1/fuel-tanks/forecast");
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

  async getDeliveries(): Promise<TankerDelivery[]> {
    const response = await api.get<TankerDelivery[]>("/v1/tanks/deliveries");
    return response.data;
  }

  async createDelivery(data: TankerDeliveryCreate): Promise<TankerDelivery> {
    const response = await api.post<TankerDelivery>("/v1/tanks/deliveries", data);
    return response.data;
  }

  async createPriceSchedule(data: PriceScheduleCreate): Promise<PriceSchedule> {
    const response = await api.post<PriceSchedule>("/v1/price-schedules", data);
    return response.data;
  }

  async getActiveRate(fuelType: FuelType, atTime?: string): Promise<{ fuel_type: FuelType; rate: number }> {
    const response = await api.get<{ fuel_type: FuelType; rate: number }>(
      "/v1/price-schedules/active-rate",
      {
        params: { fuel_type: fuelType, at_time: atTime },
      }
    );
    return response.data;
  }

  // Dispenser & Nozzle APIs
  async getDispensers(): Promise<FuelDispenser[]> {
    const response = await api.get<FuelDispenser[]>("/v1/nozzles/dispensers");
    return response.data;
  }

  async createDispenser(data: FuelDispenserCreate): Promise<FuelDispenser> {
    const response = await api.post<FuelDispenser>("/v1/nozzles/dispensers", data);
    return response.data;
  }

  async createNozzle(dispenserUuid: string, data: NozzleCreate): Promise<Nozzle> {
    const response = await api.post<Nozzle>(`/v1/nozzles/dispensers/${dispenserUuid}/nozzles`, data);
    return response.data;
  }

  async getBulkReadingsForm(date: string): Promise<BulkFormResponse> {
    const response = await api.get<BulkFormResponse>("/v1/nozzles/readings/bulk-form", {
      params: { reading_date: date },
    });
    return response.data;
  }

  async postBulkReadings(data: BulkNozzleReadingCreate): Promise<NozzleReading[]> {
    const response = await api.post<NozzleReading[]>("/v1/nozzles/readings/bulk", data);
    return response.data;
  }

  async updateDispenser(dispenserUuid: string, data: FuelDispenserCreate): Promise<FuelDispenser> {
    const response = await api.put<FuelDispenser>(`/v1/nozzles/dispensers/${dispenserUuid}`, data);
    return response.data;
  }

  async deleteDispenser(dispenserUuid: string): Promise<void> {
    await api.delete(`/v1/nozzles/dispensers/${dispenserUuid}`);
  }

  async getNozzleReadings(): Promise<NozzleReading[]> {
    const response = await api.get<NozzleReading[]>("/v1/nozzles/readings");
    return response.data;
  }

  async updateNozzle(nozzleUuid: string, data: NozzleCreate): Promise<Nozzle> {
    const response = await api.put<Nozzle>(`/v1/nozzles/${nozzleUuid}`, data);
    return response.data;
  }

  async deleteNozzle(nozzleUuid: string): Promise<void> {
    await api.delete(`/v1/nozzles/${nozzleUuid}`);
  }

  async syncLiveRates(): Promise<{ PETROL: number; SPEED: number; DIESEL: number; live: boolean }> {
    const response = await api.post<{ PETROL: number; SPEED: number; DIESEL: number; live: boolean }>(
      "/v1/price-schedules/sync"
    );
    return response.data;
  }

  async getPriceSchedules(): Promise<PriceSchedule[]> {
    const response = await api.get<PriceSchedule[]>("/v1/price-schedules");
    return response.data;
  }

  async deletePriceSchedule(uuid: string): Promise<void> {
    await api.delete(`/v1/price-schedules/${uuid}`);
  }

  async updateTank(tankUuid: string, data: Partial<FuelTankCreate> & { ignore_capacity?: boolean }): Promise<FuelTank> {
    const response = await api.put<FuelTank>(`/v1/tanks/${tankUuid}`, data);
    return response.data;
  }

  async getTransfers(): Promise<TankTransfer[]> {
    const response = await api.get<TankTransfer[]>("/v1/tanks/transfers");
    return response.data;
  }

  async createTankTransfer(data: TankTransferCreate): Promise<TankTransfer> {
    const response = await api.post<TankTransfer>("/v1/tanks/transfers", data);
    return response.data;
  }

  async deleteTankTransfer(transferUuid: string): Promise<void> {
    await api.delete(`/v1/tanks/transfers/${transferUuid}`);
  }

  async getPurchaseIndents(status?: IndentStatus): Promise<PurchaseIndent[]> {
    const response = await api.get<PurchaseIndent[]>("/v1/purchase-indents", {
      params: { indent_status: status },
    });
    return response.data;
  }

  async createPurchaseIndent(data: PurchaseIndentCreate): Promise<PurchaseIndent> {
    const response = await api.post<PurchaseIndent>("/v1/purchase-indents", data);
    return response.data;
  }

  async updatePurchaseIndentStatus(uuid: string, data: PurchaseIndentStatusUpdate): Promise<PurchaseIndent> {
    const response = await api.put<PurchaseIndent>(`/v1/purchase-indents/${uuid}/status`, data);
    return response.data;
  }

  async deletePurchaseIndent(uuid: string): Promise<void> {
    await api.delete(`/v1/purchase-indents/${uuid}`);
  }
}

const inventoryService = new InventoryService();
export default inventoryService;


