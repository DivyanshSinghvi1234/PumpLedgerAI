export type PaymentMode =
  | "CASH"
  | "UPI"
  | "CARD"
  | "CREDIT";

export type FuelType =
  | "PETROL"
  | "SPEED"
  | "DIESEL"
  | "LUBRICANT";

/** INCOME = money in, EXPENSE = money out, DEPOSIT = bank deposit. */
export type IncomeKind = "INCOME" | "EXPENSE" | "DEPOSIT";

export interface IncomeItem {
  fuel_type: FuelType;
  quantity_liters?: number | null;
  rate_per_liter?: number | null;
  amount?: number | null;
}

export interface Income {
  uuid: string;

  kind: IncomeKind;

  income_date: string;

  description: string;

  amount: number;

  category: string | null;

  payment_mode: PaymentMode;

  fuel_type?: FuelType | null;

  quantity_liters?: number | null;

  rate_per_liter?: number | null;

  is_sale?: boolean;

  is_amount_mismatch?: boolean;

  items?: IncomeItem[] | null;

  /** Set when an EXPENSE is a loan posted to a customer's ledger. */
  customer_uuid: string | null;

  customer_name: string | null;
}

export interface Pagination {
  page: number;
  page_size: number;

  total_items: number;
  total_pages: number;

  has_next: boolean;
  has_previous: boolean;
}

export interface IncomeListResponse {
  items: Income[];

  pagination: Pagination;
}

export interface CreateIncomeRequest {
  kind: IncomeKind;

  income_date: string;

  description: string;

  amount: number;

  category?: string | null;

  payment_mode: PaymentMode;

  fuel_type?: FuelType | null;

  quantity_liters?: number | null;

  rate_per_liter?: number | null;

  is_sale?: boolean;

  is_amount_mismatch?: boolean;

  items?: IncomeItem[] | null;

  customer_uuid?: string | null;

  customer_name?: string | null;
}

/** One fuel type's aggregated sales for the day: liters × rate = amount. */
export interface FuelSaleRow {
  fuel_type: FuelType;

  liters: number;

  rate: number;

  amount: number;
}

export interface IncomeSummary {
  summary_date: string;

  fuel_sales: FuelSaleRow[];

  /** Sum of fuel_sales amounts. */
  total_sales: number;

  /** Sum of the day's INCOME rows. */
  total_incomes: number;

  /** Sum of the day's EXPENSE rows. */
  total_expenses: number;

  /** Sum of the day's DEPOSIT rows. */
  total_deposits: number;

  /** Sum of customer payments received on this date. */
  total_payments: number;

  total_upi?: number;

  total_card?: number;

  total_credit?: number;

  /** total_sales + total_incomes + total_payments - total_non_cash - total_expenses - total_deposits. */
  cash_in_hand: number;
}
