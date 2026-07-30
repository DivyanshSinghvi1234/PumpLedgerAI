export type FuelType = "PETROL" | "SPEED" | "DIESEL" | "LUBRICANT";

export interface FuelTank {
  id: number;
  uuid: string;
  name: string;
  fuel_type: FuelType;
  capacity_liters: number;
  current_stock_liters: number;
  tally_godown_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FuelTankCreate {
  name: string;
  fuel_type: FuelType;
  capacity_liters: number;
  current_stock_liters: number;
  tally_godown_name?: string | null;
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

export interface TankerDelivery {
  id: number;
  uuid: string;
  tank_id: number;
  delivery_date: string;
  invoice_number: string;
  quantity_liters: number;
  density: number | null;
  supplier_name: string | null;
  remarks: string | null;
  procurement_rate?: number | null;
  payment_mode: string;
  created_at: string;
}

export interface TankerDeliveryCreate {
  tank_uuid: string;
  delivery_date: string;
  quantity_liters: number;
  invoice_number?: string;
  density?: number | null;
  supplier_name?: string | null;
  remarks?: string | null;
  procurement_rate?: number | null;
  payment_mode?: string;
  ignore_capacity?: boolean;
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
  tank_id: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NozzleCreate {
  name: string;
  fuel_type: FuelType;
  last_reading: number;
  tank_uuid?: string | null;
}

export interface NozzleReading {
  id: number;
  uuid: string;
  nozzle_id: number;
  reading_date: string;
  opening_reading: number;
  closing_reading: number;
  testing_liters: number;
  return_testing_to_storage: boolean;
  is_rollover?: boolean;
  is_meter_replaced?: boolean;
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
  return_testing_to_storage?: boolean;
  is_rollover?: boolean;
  is_meter_replaced?: boolean;
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
  return_testing_to_storage: boolean | null;
  meter_capacity?: number;
  is_rollover?: boolean;
  is_meter_replaced?: boolean;
}


export interface BulkFormResponse {
  reading_date: string;
  items: BulkFormNozzleItem[];
}

export interface FuelTankForecast {
  tank_id: number;
  tank_uuid: string;
  tank_name: string;
  fuel_type: FuelType;
  current_stock_liters: number;
  capacity_liters: number;
  avg_daily_sales: number;
  days_until_empty: number | null;
}

export interface TankTransfer {
  id: number;
  uuid: string;
  transfer_date: string;
  source_tank_id: number;
  destination_tank_id: number;
  source_tank_name?: string;
  destination_tank_name?: string;
  quantity_liters: number;
  reason: string;
  remarks?: string | null;
  created_at: string;
}

export interface TankTransferCreate {
  source_tank_uuid: string;
  destination_tank_uuid: string;
  transfer_date: string;
  quantity_liters: number;
  reason: string;
  remarks?: string | null;
  ignore_capacity?: boolean;
}

export type OMCCompany = "IOCL" | "BPCL" | "HPCL" | "RELIANCE" | "SHELL" | "NAYARA";
export type IndentStatus = "INDENTED" | "DISPATCHED" | "DELIVERED" | "CANCELLED";

export interface PurchaseIndent {
  id: number;
  uuid: string;
  indent_number: string;
  omc_company: OMCCompany;
  terminal_name: string;
  fuel_type: FuelType;
  ordered_liters: number;
  tank_truck_number?: string | null;
  expected_delivery_date: string;
  actual_delivery_date?: string | null;
  status: IndentStatus;
  decanted_tank_id?: number | null;
  decanted_tank_name?: string | null;
  density_at_15c?: number | null;
  procurement_cost_per_liter?: number | null;
  total_invoice_amount?: number | null;
  invoice_number?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseIndentCreate {
  omc_company: OMCCompany;
  terminal_name: string;
  fuel_type: FuelType;
  ordered_liters: number;
  expected_delivery_date: string;
  procurement_cost_per_liter?: number | null;
  remarks?: string | null;
}

export interface PurchaseIndentStatusUpdate {
  status: IndentStatus;
  tank_truck_number?: string | null;
  actual_delivery_date?: string | null;
  decanted_tank_uuid?: string | null;
  density_at_15c?: number | null;
  invoice_number?: string | null;
  total_invoice_amount?: number | null;
  remarks?: string | null;
}


