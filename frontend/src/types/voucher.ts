export type FuelType =
  | "PETROL"
  | "DIESEL"
  | "LUBRICANT";

export type PaymentMode =
  | "CASH"
  | "CARD"
  | "UPI"
  | "CREDIT";

export type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

export type TallyStatus =
  | "PENDING"
  | "SYNCED"
  | "FAILED";

export type PaymentStatus =
  | "UNPAID"
  | "PARTIAL"
  | "PAID";

export interface Voucher {
  uuid: string;

  invoice_number: string;

  invoice_date: string;

  vehicle_number: string | null;

  vehicle_uuid: string | null;

  customer_name: string | null;

  customer_uuid: string | null;

  fuel_type: FuelType;

  quantity_liters: number;

  rate_per_liter: number;

  total_amount: number;

  payment_mode: PaymentMode;

  verification_status: VerificationStatus;

  payment_status: "UNPAID" | "PARTIAL" | "PAID";

  amount_paid: number;

  balance_due: number;

  tally_status: TallyStatus;

  ai_provider: string | null;

  ocr_confidence: number | null;

  image_path: string | null;

  remarks: string | null;

  is_amount_mismatch: boolean;
  calculated_amount: number;

  is_active: boolean;

  /** ISO 8601 datetime string — when the voucher record was first created/saved. */
  created_at: string;

  /** ISO 8601 datetime string — when the voucher record was last modified. */
  updated_at: string;
}

export interface PaginationResponse {
  page: number;

  page_size: number;

  total_items: number;

  total_pages: number;

  has_next: boolean;

  has_previous: boolean;
}

export interface VoucherListResponse {
  items: Voucher[];

  pagination: PaginationResponse;
}

export interface CreateVoucherRequest {
  invoice_number: string;

  invoice_date: string;

  vehicle_number?: string | null;

  customer_name?: string | null;

  customer_uuid?: string | null;

  fuel_type?: FuelType | null;

  quantity_liters?: number | null;

  rate_per_liter?: number | null;

  total_amount: number;

  payment_mode: PaymentMode;

  remarks?: string | null;

  image_path?: string | null;

  items?: {
    fuel_type: FuelType;
    quantity_liters: number;
    rate_per_liter: number;
    total_amount: number;
  }[] | null;
}

export interface UpdateVoucherRequest
  extends Partial<CreateVoucherRequest> { }