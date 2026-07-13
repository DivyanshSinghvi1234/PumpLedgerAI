import api from "@/api/client";

import type { DashboardResponse } from "../types/dashboard";

class DashboardService {
  async getDashboard(): Promise<DashboardResponse> {
    const response =
      await api.get<DashboardResponse>(
        "/v1/dashboard"
      );

    return response.data;
  }
}

const dashboardService =
  new DashboardService();

export default dashboardService;
