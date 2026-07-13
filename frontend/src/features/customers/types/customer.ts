export interface Customer {
  uuid: string;

  customer_code: string | null;

  name: string;

  mobile: string | null;

  email: string | null;

  gst_number: string | null;

  address: string | null;

  city: string | null;

  state: string | null;

  pincode: string | null;

  credit_limit: number;

  opening_balance: number;

  outstanding_balance: number;

  remarks: string | null;

  is_active: boolean;
}

export interface Pagination {
  page: number;
  page_size: number;

  total_items: number;
  total_pages: number;

  has_next: boolean;
  has_previous: boolean;
}

export interface CustomerListResponse {
  items: Customer[];

  pagination: Pagination;
}

export interface CreateCustomerRequest {
  customer_code?: string;

  name: string;

  mobile?: string;

  email?: string;

  gst_number?: string;

  address?: string;

  city?: string;

  state?: string;

  pincode?: string;

  credit_limit?: number;

  opening_balance?: number;

  remarks?: string;
}

export interface UpdateCustomerRequest {
  customer_code?: string;

  name?: string;

  mobile?: string;

  email?: string;

  gst_number?: string;

  address?: string;

  city?: string;

  state?: string;

  pincode?: string;

  credit_limit?: number;

  opening_balance?: number;

  remarks?: string;

  is_active?: boolean;
}