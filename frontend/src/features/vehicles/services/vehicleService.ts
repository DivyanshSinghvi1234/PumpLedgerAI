import api from "@/api/client";

import type {
  Vehicle,
  VehicleListResponse,
  VehicleLedgerResponse,
  CreateVehicleRequest,
  UpdateVehicleRequest,
} from "../types/vehicle";

export interface VehicleSearchParams {
  search?: string;

  page?: number;

  page_size?: number;
}

class VehicleService {
  async getVehicles(
    params: VehicleSearchParams = {}
  ): Promise<VehicleListResponse> {
    const response =
      await api.get<VehicleListResponse>(
        "/v1/vehicles",
        {
          params,
        }
      );

    return response.data;
  }

  async getVehicle(
    uuid: string
  ): Promise<Vehicle> {
    const response =
      await api.get<Vehicle>(
        `/v1/vehicles/${uuid}`
      );

    return response.data;
  }

  async createVehicle(
    data: CreateVehicleRequest
  ): Promise<Vehicle> {
    const response =
      await api.post<Vehicle>(
        "/v1/vehicles",
        data
      );

    return response.data;
  }

  async updateVehicle(
    uuid: string,
    data: UpdateVehicleRequest
  ): Promise<Vehicle> {
    const response =
      await api.put<Vehicle>(
        `/v1/vehicles/${uuid}`,
        data
      );

    return response.data;
  }

  async deleteVehicle(
    uuid: string
  ): Promise<void> {
    await api.delete(
      `/v1/vehicles/${uuid}`
    );
  }

  async getVehicleLedger(
    uuid: string
  ): Promise<VehicleLedgerResponse> {
    const response =
      await api.get<VehicleLedgerResponse>(
        `/v1/vehicles/${uuid}/ledger`
      );

    return response.data;
  }
}

const vehicleService =
  new VehicleService();

export default vehicleService;
