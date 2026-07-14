import api from "@/api/client";

import type {
  Payment,
  PaymentListResponse,
  CreatePaymentRequest,
} from "../types/payment";

export interface PaymentSearchParams {
  customer_uuid?: string;
  search?: string;
  payment_date?: string;
  page?: number;
  page_size?: number;
}

class PaymentService {
  async getPayments(
    params: PaymentSearchParams = {}
  ): Promise<PaymentListResponse> {
    const response =
      await api.get<PaymentListResponse>(
        "/v1/payments",
        {
          params,
        }
      );

    return response.data;
  }

  async getPayment(
    uuid: string
  ): Promise<Payment> {
    const response =
      await api.get<Payment>(
        `/v1/payments/${uuid}`
      );

    return response.data;
  }

  async createPayment(
    data: CreatePaymentRequest
  ): Promise<Payment> {
    const response =
      await api.post<Payment>(
        "/v1/payments/allocate-fifo",
        data
      );

    return response.data;
  }

  async deletePayment(
    uuid: string
  ): Promise<void> {
    await api.delete(
      `/v1/payments/${uuid}`
    );
  }
}

const paymentService =
  new PaymentService();

export default paymentService;
