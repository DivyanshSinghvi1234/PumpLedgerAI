export type FuelType = "PETROL" | "DIESEL" | "LUBRICANT";

export interface FuelTank {
  id: number;
  uuid: string;
  name: string;
  fuel_type: FuelType;
  capacity_liters: number;
  current_stock_liters: number;
  created_at: string;
  updated_at: string;
}

export interface FuelTankCreate {
  name: string;
  fuel_type: FuelType;
  capacity_liters: number;
  current_stock_liters: number;
}

export interface DipReading {
  id: number;
  uuid: string;
  tank_id: number;
  reading_date: string;
  opening_dip_liters: number;
  closing_dip_liters: number;
  sales_liters_calculated: number;
  actual_sales_from_vouchers: number;
  variance_liters: number;
  created_at: string;
}

export interface DipReadingCreate {
  opening_dip_liters: number;
  closing_dip_liters: number;
  reading_date?: string;
}

export interface PriceSchedule {
  id: number;
  uuid: string;
  fuel_type: FuelType;
  rate: number;
  effective_from: string;
  is_applied: boolean;
  created_at: string;
}

export interface PriceScheduleCreate {
  fuel_type: FuelType;
  rate: number;
  effective_from: string;
}
