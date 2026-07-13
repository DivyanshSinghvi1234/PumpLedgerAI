import api from "@/api/client";

import type {
  Customer,
  CustomerListResponse,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "../types/customer";

export interface CustomerSearchParams {
  search?: string;

  page?: number;

  page_size?: number;
}

class CustomerService {
  async getCustomers(
    params: CustomerSearchParams = {}
  ): Promise<CustomerListResponse> {
    const response =
      await api.get<CustomerListResponse>(
        "/v1/customers",
        {
          params,
        }
      );

    return response.data;
  }

  async getCustomer(
    uuid: string
  ): Promise<Customer> {
    const response =
      await api.get<Customer>(
        `/v1/customers/${uuid}`
      );

    return response.data;
  }

  async createCustomer(
    data: CreateCustomerRequest
  ): Promise<Customer> {
    const response =
      await api.post<Customer>(
        "/v1/customers",
        data
      );

    return response.data;
  }

  async updateCustomer(
    uuid: string,
    data: UpdateCustomerRequest
  ): Promise<Customer> {
    const response =
      await api.put<Customer>(
        `/v1/customers/${uuid}`,
        data
      );

    return response.data;
  }

  async deleteCustomer(
    uuid: string
  ): Promise<void> {
    await api.delete(
      `/v1/customers/${uuid}`
    );
  }
}

const customerService =
  new CustomerService();

export default customerService;