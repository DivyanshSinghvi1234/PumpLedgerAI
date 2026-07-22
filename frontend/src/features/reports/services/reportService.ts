import api from "@/api/client";

import type {
  VoucherReportResponse,
  CustomerReportResponse,
  LedgerReportResponse,
  DailyReportResponse,
  DebtorAgingResponse,
} from "../types/report";

export interface VoucherReportParams {
  from_date?: string;
  to_date?: string;
  fuel_type?: string;
  payment_mode?: string;
  verification_status?: string;
}

export interface DailySalesParams {
  on_date?: string;
}

class ReportService {
  async voucherReport(
    params: VoucherReportParams = {}
  ): Promise<VoucherReportResponse> {
    const response =
      await api.get<VoucherReportResponse>(
        "/v1/reports/vouchers",
        { params }
      );

    return response.data;
  }

  async customerReport(
    search?: string
  ): Promise<CustomerReportResponse> {
    const response =
      await api.get<CustomerReportResponse>(
        "/v1/reports/customers",
        { params: { search } }
      );

    return response.data;
  }

  async ledgerReport(
    customerUuid: string,
    params: { from_date?: string; to_date?: string } = {}
  ): Promise<LedgerReportResponse> {
    const response =
      await api.get<LedgerReportResponse>(
        `/v1/reports/ledger/${customerUuid}`,
        { params }
      );

    return response.data;
  }

  async dailySales(
    params: DailySalesParams = {}
  ): Promise<DailyReportResponse> {
    const response =
      await api.get<DailyReportResponse>(
        "/v1/reports/daily-sales",
        { params }
      );

    return response.data;
  }

  async debtorAging(
    asOf?: string
  ): Promise<DebtorAgingResponse> {
    const response =
      await api.get<DebtorAgingResponse>(
        "/v1/reports/debtor-aging",
        { params: { as_of: asOf } }
      );

    return response.data;
  }

  /**
   * Fetch a CSV export as a blob and trigger a browser download.
   * The axios interceptor attaches the bearer token, so the request
   * is authenticated like any other.
   */
  async downloadCsv(
    path: string,
    params: Record<string, unknown>,
    filename: string
  ): Promise<void> {
    const response = await api.get(path, {
      params,
      responseType: "blob",
    });

    const url = URL.createObjectURL(
      new Blob([response.data], { type: "text/csv" })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(url);
  }
}

const reportService = new ReportService();

export default reportService;
