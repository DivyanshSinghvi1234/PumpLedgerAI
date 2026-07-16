export type LedgerEntryType =
  | "OPENING_BALANCE"
  | "VOUCHER"
  | "PAYMENT"
  | "DEBIT_ADJUSTMENT"
  | "CREDIT_ADJUSTMENT";

export type AdjustmentType =
  | "DEBIT_ADJUSTMENT"
  | "CREDIT_ADJUSTMENT";

export interface LedgerEntry {
  uuid: string;

  entry_type: LedgerEntryType;

  amount: number;

  signed_amount: number;

  balance_after: number;

  entry_date: string;

  reference_type: string | null;

  remarks: string | null;

  image_path?: string | null;

  invoice_number?: string | null;

  status?: string | null;

  is_amount_mismatch?: boolean;
}

export interface Pagination {
  page: number;
  page_size: number;

  total_items: number;
  total_pages: number;

  has_next: boolean;
  has_previous: boolean;
}

export interface LedgerListResponse {
  customer_uuid: string;

  customer_name: string;

  opening_balance: number;

  closing_balance: number;

  items: LedgerEntry[];

  pagination: Pagination;
}

export interface CreateAdjustmentRequest {
  entry_type: AdjustmentType;

  amount: number;

  entry_date: string;

  remarks?: string | null;
}
