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

export interface Voucher {
  uuid: string;

  invoice_number: string;

  invoice_date: string;

  vehicle_number: string | null;

  customer_name: string | null;

  customer_uuid: string | null;

  fuel_type: FuelType;

  quantity_liters: number;

  rate_per_liter: number;

  total_amount: number;

  payment_mode: PaymentMode;

  verification_status: VerificationStatus;

  tally_status: TallyStatus;

  ai_provider: string | null;

  ocr_confidence: number | null;

  image_path: string | null;

  remarks: string | null;

  is_active: boolean;
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

  fuel_type: FuelType;

  quantity_liters: number;

  rate_per_liter: number;

  total_amount: number;

  payment_mode: PaymentMode;

  remarks?: string | null;

  image_path?: string | null;
}

export interface UpdateVoucherRequest
  extends Partial<CreateVoucherRequest> {}