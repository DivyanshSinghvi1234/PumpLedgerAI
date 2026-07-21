import api from "@/api/client";

import type {
  Income,
  IncomeKind,
  IncomeListResponse,
  IncomeSummary,
  CreateIncomeRequest,
} from "../types/income";

export interface IncomeSearchParams {
  income_date?: string;
  kind?: IncomeKind;
  search?: string;
  page?: number;
  page_size?: number;
}

class IncomeService {
  async getIncomes(
    params: IncomeSearchParams = {}
  ): Promise<IncomeListResponse> {
    const response = await api.get<IncomeListResponse>(
      "/v1/income",
      {
        params,
      }
    );

    return response.data;
  }

  async getSummary(
    onDate: string
  ): Promise<IncomeSummary> {
    const response = await api.get<IncomeSummary>(
      "/v1/income/summary",
      {
        params: { on_date: onDate },
      }
    );

    return response.data;
  }

  async getCategories(): Promise<string[]> {
    const response = await api.get<string[]>(
      "/v1/income/categories"
    );

    return response.data;
  }

  async createIncome(
    data: CreateIncomeRequest
  ): Promise<Income> {
    const response = await api.post<Income>(
      "/v1/income",
      data
    );

    return response.data;
  }

  async updateIncome(
    uuid: string,
    data: CreateIncomeRequest
  ): Promise<Income> {
    const response = await api.put<Income>(
      `/v1/income/${uuid}`,
      data
    );

    return response.data;
  }

  async deleteIncome(uuid: string): Promise<void> {
    await api.delete(`/v1/income/${uuid}`);
  }
}

const incomeService = new IncomeService();

export default incomeService;
