import type { Voucher } from "@/types/voucher";

export interface Vehicle {
  uuid: string;

  customer_uuid: string;

  customer_name: string;

  vehicle_number: string;

  vehicle_type: string | null;

  /** Live SUM(balance_due) for this vehicle. */
  outstanding_balance: string;
}

export interface VehicleLedgerResponse {
  vehicle_uuid: string;

  vehicle_number: string;

  vehicle_type: string | null;

  customer_uuid: string;

  customer_name: string;

  outstanding: string;

  voucher_count: number;

  vouchers: Voucher[];
}

export interface Pagination {
  page: number;
  page_size: number;

  total_items: number;
  total_pages: number;

  has_next: boolean;
  has_previous: boolean;
}

export interface VehicleListResponse {
  items: Vehicle[];

  pagination: Pagination;
}

export interface CreateVehicleRequest {
  customer_uuid: string;

  vehicle_number: string;

  vehicle_type?: string | null;
}

export interface UpdateVehicleRequest {
  vehicle_number?: string;

  vehicle_type?: string | null;

  is_active?: boolean;
}
