import type { Voucher } from "@/types/voucher";

export interface DashboardSummary {
  today_sales: number;

  total_sales: number;

  today_vouchers: number;

  total_vouchers: number;

  total_customers: number;

  total_vehicles: number;

  pending_review: number;

  verified: number;
}

export interface FuelDistribution {
  petrol: number;

  diesel: number;

  lubricant: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;

  fuel_distribution: FuelDistribution;

  recent_vouchers: Voucher[];
}
