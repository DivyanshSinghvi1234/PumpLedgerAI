import type { Voucher } from "@/types/voucher";
import type { Payment } from "../payments/types/payment";

export interface TallyLedgerMappings {
  cash_ledger: string;
  upi_ledger: string;
  card_ledger: string;
  petrol_sales_ledger: string;
  diesel_sales_ledger: string;
  lubricant_sales_ledger: string;
}

export interface TallyVoucherTypes {
  sales: string;
  receipt: string;
}

export interface TallyExportRequest {
  from_date?: string;
  to_date?: string;
  mark_as_synced: boolean;
  ledger_mappings: TallyLedgerMappings;
  voucher_types: TallyVoucherTypes;
}

export interface TallyPreviewResponse {
  total_vouchers: number;
  total_payments: number;
  total_sales_amount: number;
  total_receipts_amount: number;
  vouchers: Voucher[];
  payments: Payment[];
  warnings: string[];
}

export interface TallyMarkSyncedRequest {
  voucher_uuids: string[];
  payment_uuids: string[];
}
