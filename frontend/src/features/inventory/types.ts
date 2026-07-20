export type FuelType = "PETROL" | "SPEED" | "DIESEL" | "LUBRICANT";

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

// Dispenser & Nozzle structural updates
export interface FuelDispenser {
  id: number;
  uuid: string;
  name: string;
  status: string;
  nozzles: Nozzle[];
  created_at: string;
  updated_at: string;
}

export interface FuelDispenserCreate {
  name: string;
  status?: string;
}

export interface Nozzle {
  id: number;
  uuid: string;
  dispenser_id: number;
  name: string;
  fuel_type: FuelType;
  last_reading: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NozzleCreate {
  name: string;
  fuel_type: FuelType;
  last_reading: number;
}

export interface NozzleReading {
  id: number;
  uuid: string;
  nozzle_id: number;
  reading_date: string;
  opening_reading: number;
  closing_reading: number;
  testing_liters: number;
  sales: number;
  total_sales: number;
  created_at: string;
}

export interface NozzleReadingCreate {
  nozzle_uuid: string;
  opening_reading?: number;
  closing_reading: number;
  opening_time?: string;       // HH:MM, default "19:30"
  closing_time?: string;       // HH:MM, default "19:30"
  interim_6am_reading?: number | null; // Optional 6:00 AM meter reading
  testing_liters?: number;
}

export interface BulkNozzleReadingCreate {
  reading_date: string;
  readings: NozzleReadingCreate[];
}

export interface BulkFormNozzleItem {
  nozzle_uuid: string;
  nozzle_name: string;
  dispenser_name: string;
  fuel_type: FuelType;
  opening_reading: number;
  closing_reading: number | null;
  sales: number | null;
  opening_time: string | null;
  closing_time: string | null;
  interim_6am_reading: number | null;
  testing: number | null;
}

export interface BulkFormResponse {
  reading_date: string;
  items: BulkFormNozzleItem[];
}
