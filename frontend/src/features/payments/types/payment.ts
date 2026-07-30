export type PaymentMode =
  | "CASH"
  | "UPI"
  | "CARD"
  | "BANK"
  | "CREDIT";

export interface Payment {
  uuid: string;

  customer_uuid: string;

  customer_name: string;

  amount: number;

  payment_mode: PaymentMode;

  bank_account_uuid?: string | null;

  payment_date: string;


  reference_number: string | null;

  remarks: string | null;

  tally_status: "PENDING" | "SYNCED" | "FAILED";
}

export interface Pagination {
  page: number;
  page_size: number;

  total_items: number;
  total_pages: number;

  has_next: boolean;
  has_previous: boolean;
}

export interface PaymentListResponse {
  items: Payment[];

  pagination: Pagination;
}

export interface CreatePaymentRequest {
  customer_uuid: string;

  amount: number;

  payment_mode: PaymentMode;

  bank_account_uuid?: string | null;

  payment_date: string;


  reference_number?: string | null;

  remarks?: string | null;

  /**
   * Optional: scope FIFO allocation to a single vehicle's vouchers. When
   * omitted the payment settles the customer's oldest vouchers across all
   * vehicles.
   */
  vehicle_uuid?: string | null;

  /**
   * Optional: vehicle number string when typed or selected.
   */
  vehicle_number?: string | null;
}
