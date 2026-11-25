export interface DayClosingNozzleLine {
  nozzle_uuid: string;
  nozzle_name: string;
  fuel_type: string;
  opening_reading: number;
  closing_reading: number | null;
  interim_6am_reading: number | null;
  testing_liters: number;
  sales_liters: number;
  rate: number;
  amount: number;
  missing_reading: boolean;
}

export interface DayClosingTankDipPreview {
  tank_uuid: string;
  tank_name: string;
  fuel_type: string;
  capacity_liters: number;
  book_stock: number;
  physical_dip: number | null;
  variance_liters: number | null;
  status: string;
}

export interface DayClosingWarning {
  type: string;
  severity: "WARNING" | "ERROR" | "INFO" | string;
  message: string;
}

export interface DayClosingDraftResponse {
  closing_date: string;
  already_closed: boolean;
  existing_closing_uuid: string | null;
  gross_meter_sales: number;
  cash_sales: number;
  upi_sales: number;
  card_sales: number;
  bank_sales: number;
  credit_sales: number;
  total_voucher_sales: number;
  upi_count: number;
  card_count: number;
  credit_count: number;
  cash_expenses: number;
  opening_float: number;
  nozzle_lines: DayClosingNozzleLine[];
  tank_dips: DayClosingTankDipPreview[];
  warnings: DayClosingWarning[];
}

export interface DayClosingCreate {
  closing_date: string;
  opening_float?: number | null;
  physical_cash_counted?: number | null;
  cash_to_next_day: number;
  notes_500: number;
  notes_200: number;
  notes_100: number;
  notes_50: number;
  notes_20: number;
  notes_10: number;
  coins: number;
  tank_dips: Record<string, number>;
  notes?: string | null;
}

export interface DayClosingResponse {
  uuid: string;
  closing_date: string;
  status: string;
  gross_meter_sales: number;
  cash_sales: number;
  upi_sales: number;
  card_sales: number;
  bank_sales: number;
  credit_sales: number;
  total_voucher_sales: number;
  cash_expenses: number;
  opening_float: number;
  physical_cash_counted: number;
  cash_to_next_day: number;
  expected_cash: number;
  variance: number;
  notes_500: number;
  notes_200: number;
  notes_100: number;
  notes_50: number;
  notes_20: number;
  notes_10: number;
  coins: number;
  warnings: DayClosingWarning[] | null;
  closed_at: string | null;
  nozzle_snapshot: DayClosingNozzleLine[] | null;
  notes: string | null;
}

export interface StockVarianceItem {
  uuid: string;
  tank_uuid: string;
  tank_name: string;
  fuel_type: string;
  capacity_liters: number;
  variance_date: string;
  opening_stock: number;
  deliveries_received: number;
  meter_sales: number;
  testing_qty: number;
  book_stock: number;
  physical_dip: number | null;
  variance_liters: number | null;
  variance_percent: number | null;
  variance_amount: number | null;
  status: "OK" | "WARNING" | "CRITICAL" | "PENDING_DIP" | string;
  threshold_percent: number;
}

export interface StockAlert {
  tank_uuid: string;
  tank_name: string;
  fuel_type: string;
  consecutive_critical_days: number;
  latest_variance_liters: number;
  latest_variance_percent: number;
  message: string;
}

export interface StockVarianceDailySummary {
  variance_date: string;
  threshold_percent: number;
  items: StockVarianceItem[];
  alerts: StockAlert[];
}
