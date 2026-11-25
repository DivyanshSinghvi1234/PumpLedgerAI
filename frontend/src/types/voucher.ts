export type FuelType =
  | "PETROL"
  | "SPEED"
  | "DIESEL"
  | "LUBRICANT";

export type PaymentMode =
  | "CASH"
  | "CARD"
  | "UPI"
  | "BANK"
  | "CREDIT"
  | "SPLIT";


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

  customer_mobile: string | null;


  fuel_type: FuelType;

  quantity_liters: number;

  rate_per_liter: number;

  total_amount: number;

  payment_mode: PaymentMode;

  cash_amount?: number | null;

  upi_amount?: number | null;

  card_amount?: number | null;

  credit_amount?: number | null;

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

  bank_account_uuid?: string | null;

  override_credit_limit?: boolean;

  cash_amount?: number | null;


  upi_amount?: number | null;

  card_amount?: number | null;

  credit_amount?: number | null;

  remarks?: string | null;

  image_path?: string | null;


  items?: {
    fuel_type: FuelType;
    quantity_liters: number;
    rate_per_liter: number;
    total_amount: number;
  }[] | null;
}

export type UpdateVoucherRequest = Partial<CreateVoucherRequest>;

export interface VoucherSuggestRequest {
  vehicle_number?: string | null;
  customer_uuid?: string | null;
  customer_name?: string | null;
  fuel_type?: FuelType | null;
  quantity_liters?: number | null;
  rate_per_liter?: number | null;
  total_amount?: number | null;
  invoice_date?: string | null;
  exclude_voucher_uuid?: string | null;
}

export interface FuzzyCustomerCandidate {
  customer_uuid: string;
  customer_name: string;
  customer_code?: string | null;
  mobile?: string | null;
  score: number;
}

export interface SuggestionWarning {
  type: "UNUSUAL_QUANTITY" | "POSSIBLE_DUPLICATE" | "FUZZY_CUSTOMER_MATCH" | "CREDIT_LIMIT_EXCEEDED";
  message: string;
  duplicate_uuid?: string | null;
  duplicate_invoice_number?: string | null;
  candidates: FuzzyCustomerCandidate[];
}

export interface VoucherSuggestionResponse {
  normalized_vehicle_number: string | null;
  vehicle_uuid: string | null;
  customer_uuid: string | null;
  customer_name: string | null;
  customer_confidence: number;
  fuel_type: FuelType | null;
  fuel_type_confidence: number;
  rate_per_liter: number | null;
  payment_mode: PaymentMode | null;
  payment_mode_confidence: number;
  vehicle_avg_quantity: number | null;
  vehicle_sample_count: number;
  warnings: SuggestionWarning[];
}
