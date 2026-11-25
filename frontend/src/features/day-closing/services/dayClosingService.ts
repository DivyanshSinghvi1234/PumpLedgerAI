import api from "@/api/client";
import type {
  DayClosingCreate,
  DayClosingDraftResponse,
  DayClosingResponse,
  StockVarianceDailySummary,
  StockVarianceItem,
} from "../types/dayClosing";

class DayClosingService {
  async getDraft(closingDate: string): Promise<DayClosingDraftResponse> {
    const res = await api.get<DayClosingDraftResponse>("/v1/day-closings/draft", {
      params: { date: closingDate },
    });
    return res.data;
  }

  async closeDay(payload: DayClosingCreate): Promise<DayClosingResponse> {
    const res = await api.post<DayClosingResponse>("/v1/day-closings", payload);
    return res.data;
  }

  async listClosings(limit = 30): Promise<DayClosingResponse[]> {
    const res = await api.get<DayClosingResponse[]>("/v1/day-closings", {
      params: { limit },
    });
    return res.data;
  }

  async reopenClosing(closingUuid: string): Promise<DayClosingResponse> {
    const res = await api.post<DayClosingResponse>(`/v1/day-closings/${closingUuid}/reopen`);
    return res.data;
  }

  async getDailyStockVariance(varianceDate: string): Promise<StockVarianceDailySummary> {
    const res = await api.get<StockVarianceDailySummary>("/v1/stock-variances/daily", {
      params: { variance_date: varianceDate },
    });
    return res.data;
  }

  async recordDips(
    varianceDate: string,
    dips: { tank_uuid: string; physical_dip: number }[]
  ): Promise<StockVarianceDailySummary> {
    const res = await api.post<StockVarianceDailySummary>("/v1/stock-variances/dips", {
      variance_date: varianceDate,
      dips,
    });
    return res.data;
  }

  async getTankTrend(tankUuid: string, days = 14): Promise<StockVarianceItem[]> {
    const res = await api.get<StockVarianceItem[]>(`/v1/stock-variances/tanks/${tankUuid}/trend`, {
      params: { days },
    });
    return res.data;
  }
}

const dayClosingService = new DayClosingService();
export default dayClosingService;
