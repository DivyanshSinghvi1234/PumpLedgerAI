import api from "@/api/client";

import type {
  Voucher,
  VoucherListResponse,
  CreateVoucherRequest,
  UpdateVoucherRequest,
} from "@/types/voucher";

export interface VoucherSearchParams {
  search?: string;
  fuel_type?: string;
  payment_mode?: string;
  verification_status?: string;
  customer_uuid?: string;
  from_date?: string;
  to_date?: string;
  /** ISO 8601 datetime string — filter vouchers saved on or after this time. */
  from_datetime?: string;
  /** ISO 8601 datetime string — filter vouchers saved on or before this time. */
  to_datetime?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

class VoucherService {
  async getVouchers(
    params: VoucherSearchParams = {}
  ): Promise<VoucherListResponse> {
    const response = await api.get<VoucherListResponse>(
      "/v1/vouchers",
      {
        params,
      }
    );

    return response.data;
  }

  async getVoucher(
    uuid: string
  ): Promise<Voucher> {
    const response = await api.get<Voucher>(
      `/v1/vouchers/${uuid}`
    );

    return response.data;
  }

  async createVoucher(
    data: CreateVoucherRequest
  ): Promise<Voucher> {
    const response = await api.post<Voucher>(
      "/v1/vouchers",
      data
    );

    return response.data;
  }

  async updateVoucher(
    uuid: string,
    data: UpdateVoucherRequest
  ): Promise<Voucher> {
    const response = await api.put<Voucher>(
      `/v1/vouchers/${uuid}`,
      data
    );

    return response.data;
  }

  async deleteVoucher(
    uuid: string
  ): Promise<void> {
    await api.delete(
      `/v1/vouchers/${uuid}`
    );
  }

  async verifyVoucher(
    uuid: string
  ): Promise<Voucher> {
    const response = await api.post<Voucher>(
      `/v1/vouchers/${uuid}/verify`
    );

    return response.data;
  }

  async rejectVoucher(
    uuid: string
  ): Promise<Voucher> {
    const response = await api.post<Voucher>(
      `/v1/vouchers/${uuid}/reject`
    );

    return response.data;
  }
}

const voucherService = new VoucherService();

export default voucherService;

/*
|--------------------------------------------------------------------------
| Backward compatibility
|--------------------------------------------------------------------------
| These exports allow older components (like OCRReviewForm)
| to continue working while the project is migrated to the
| class-based service pattern.
|--------------------------------------------------------------------------
*/

export const getVouchers =
  voucherService.getVouchers.bind(voucherService);

export const getVoucher =
  voucherService.getVoucher.bind(voucherService);

export const createVoucher =
  voucherService.createVoucher.bind(voucherService);

export const updateVoucher =
  voucherService.updateVoucher.bind(voucherService);

export const deleteVoucher =
  voucherService.deleteVoucher.bind(voucherService);

export const verifyVoucher =
  voucherService.verifyVoucher.bind(voucherService);

export const rejectVoucher =
  voucherService.rejectVoucher.bind(voucherService);