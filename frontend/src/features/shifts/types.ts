import type { Employee } from "../employees/types";

export interface Shift {
  id: number;
  uuid: string;
  employee: Employee;
  start_time: string;
  end_time: string | null;
  opening_cash: number;
  closing_cash_reported: number | null;
  total_sales_amount: number;
  cash_reconciled: boolean;
  variance: number | null;
  created_at: string;
}

export interface ShiftStartRequest {
  employee_uuid: string;
  opening_cash: number;
}

export interface ShiftEndRequest {
  closing_cash_reported: number;
}

export interface ShiftTimetable {
  id: number;
  uuid: string;
  employee: Employee;
  day_of_week: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface ShiftTimetableCreate {
  employee_uuid: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

export interface ShiftTimetableUpdate {
  day_of_week?: string;
  start_time?: string;
  end_time?: string;
}
