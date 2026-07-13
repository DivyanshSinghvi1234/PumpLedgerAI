import api from "@/api/client";

import type {
  LedgerEntry,
  LedgerListResponse,
  CreateAdjustmentRequest,
} from "../types/ledger";

export interface LedgerSearchParams {
  page?: number;

  page_size?: number;
}

class LedgerService {
  async getLedger(
    customerUuid: string,
    params: LedgerSearchParams = {}
  ): Promise<LedgerListResponse> {
    const response =
      await api.get<LedgerListResponse>(
        `/v1/customers/${customerUuid}/ledger`,
        {
          params,
        }
      );

    return response.data;
  }

  async createAdjustment(
    customerUuid: string,
    data: CreateAdjustmentRequest
  ): Promise<LedgerEntry> {
    const response =
      await api.post<LedgerEntry>(
        `/v1/customers/${customerUuid}/ledger/adjustments`,
        data
      );

    return response.data;
  }
}

const ledgerService = new LedgerService();

export default ledgerService;
