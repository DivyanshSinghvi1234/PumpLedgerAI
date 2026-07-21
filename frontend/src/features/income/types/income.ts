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

/** INCOME = money in, EXPENSE = money out. */
export type IncomeKind = "INCOME" | "EXPENSE";

export interface Income {
  uuid: string;

  kind: IncomeKind;

  income_date: string;

  description: string;

  amount: number;

  category: string | null;

  payment_mode: PaymentMode;

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

  /**
   * Optional customer link. Only meaningful for an EXPENSE that is a loan:
   * the amount is posted as a debit to that customer's ledger. Send
   * `customer_uuid` for an existing customer, or `customer_name` (with a null
   * uuid) to have the backend resolve-or-create the customer by name.
   */
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

  /** total_sales + total_incomes - total_expenses. */
  cash_in_hand: number;
}
