import type {
  FuelType,
  PaymentMode,
  VerificationStatus,
} from "@/types/voucher";

// ---------- Voucher Report ----------

export interface VoucherReportRow {
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  vehicle_number: string | null;
  fuel_type: FuelType;
  quantity_liters: number;
  rate_per_liter: number;
  total_amount: number;
  payment_mode: PaymentMode;
  verification_status: VerificationStatus;
}

export interface VoucherReportResponse {
  rows: VoucherReportRow[];
  total_amount: number;
  total_quantity: number;
  count: number;
}

// ---------- Customer Report ----------

export interface CustomerReportRow {
  customer_code: string | null;
  name: string;
  mobile: string | null;
  gst_number: string | null;
  credit_limit: number;
  outstanding_balance: number;
}

export interface CustomerReportResponse {
  rows: CustomerReportRow[];
  total_outstanding: number;
  count: number;
}

// ---------- Ledger Report ----------

export interface LedgerReportRow {
  entry_type: string;
  amount: number;
  signed_amount: number;
  balance_after: number;
  entry_date: string;
  reference_type: string | null;
  remarks: string | null;
}

export interface LedgerReportResponse {
  customer_uuid: string;
  customer_name: string;
  from_date: string | null;
  to_date: string | null;
  opening_balance: number;
  closing_balance: number;
  rows: LedgerReportRow[];
  count: number;
}

// ---------- Daily Sales ----------

export interface DailyReportResponse {
  report_date: string;
  total_sales: number;
  total_vouchers: number;
  petrol_sales: number;
  diesel_sales: number;
  cash_sales: number;
  upi_sales: number;
  credit_sales: number;
  average_invoice: number;
}
