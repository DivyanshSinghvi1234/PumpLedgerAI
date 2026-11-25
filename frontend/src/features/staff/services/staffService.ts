import api from "@/api/client";

export interface EmployeeItem {
  id: number;
  uuid: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: string;
  base_salary: number;
  commission_rate_per_liter: number;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeCreateInput {
  full_name: string;
  phone?: string | null;
  email?: string | null;
  role: string;
  base_salary: number;
  commission_rate_per_liter: number;
}

export interface StaffLedgerEntry {
  uuid: string;
  entry_date: string;
  entry_type: "ADVANCE" | "LOAN" | "SHORTAGE" | "COMMISSION" | "SALARY_PAYMENT" | "REPAYMENT";
  amount: number;
  signed_amount: number;
  remarks: string | null;
  reference_type: string | null;
  created_at: string;
}

export interface StaffLedgerSummary {
  employee_uuid: string;
  full_name: string;
  role: string;
  base_salary: number;
  commission_rate_per_liter: number;
  outstanding_balance: number;
  entries: StaffLedgerEntry[];
}

export interface StaffPayrollRow {
  employee_uuid: string;
  full_name: string;
  role: string;
  base_salary: number;
  days_worked?: number | null;
  days_in_month?: number | null;
  prorated_base_salary?: number | null;
  commission_earned: number;
  advances_and_loans: number;
  shift_shortages: number;
  outstanding_balance: number;
  net_payable: number;
  already_paid_this_month?: boolean;
}

export interface StaffPayrollPreview {
  billing_month: string;
  total_base_salary: number;
  total_commission: number;
  total_deductions: number;
  total_net_payable: number;
  rows: StaffPayrollRow[];
}

const staffService = {
  async listEmployees(): Promise<EmployeeItem[]> {
    const res = await api.get<EmployeeItem[]>("/v1/employees");
    return res.data;
  },

  async createEmployee(data: EmployeeCreateInput): Promise<EmployeeItem> {
    const res = await api.post<EmployeeItem>("/v1/employees", data);
    return res.data;
  },

  async syncFromUsers(): Promise<EmployeeItem[]> {
    const res = await api.post<EmployeeItem[]>("/v1/employees/sync-from-users");
    return res.data;
  },

  async getLedger(employeeUuid: string): Promise<StaffLedgerSummary> {
    const res = await api.get<StaffLedgerSummary>(`/v1/employees/${employeeUuid}/ledger`);
    return res.data;
  },

  async recordLedgerEntry(
    employeeUuid: string,
    data: {
      entry_date: string;
      entry_type: StaffLedgerEntry["entry_type"];
      amount: number;
      remarks?: string;
    }
  ): Promise<StaffLedgerEntry> {
    const res = await api.post<StaffLedgerEntry>(
      `/v1/employees/${employeeUuid}/ledger`,
      data
    );
    return res.data;
  },

  async previewPayroll(month: string): Promise<StaffPayrollPreview> {
    const res = await api.get<StaffPayrollPreview>("/v1/employees/payroll/preview", {
      params: { month },
    });
    return res.data;
  },

  async paySalary(
    employeeUuid: string,
    data: {
      billing_month: string;
      payment_mode: string;
      bank_account_uuid?: string | null;
      deduct_outstanding: boolean;
      remarks?: string;
    }
  ) {
    const res = await api.post(`/v1/employees/${employeeUuid}/pay-salary`, data);
    return res.data;
  },

  async payAllSalaries(data: {
    billing_month: string;
    payment_mode: string;
    bank_account_uuid?: string | null;
    deduct_outstanding?: boolean;
    remarks?: string;
  }): Promise<{
    billing_month: string;
    paid_count: number;
    skipped_count: number;
    total_net_paid: number;
  }> {
    const res = await api.post("/v1/employees/payroll/pay-all", data);
    return res.data;
  },

  async markAttendance(data: {
    employee_uuid: string;
    attendance_date: string;
    status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";
    overtime_hours?: number;
    notes?: string;
  }) {
    const res = await api.post("/v1/employees/attendance", data);
    return res.data;
  },

  async syncAttendanceFromShifts(attendanceDate?: string): Promise<{
    attendance_date: string;
    marked_present_count: number;
  }> {
    const res = await api.post("/v1/employees/attendance/sync-from-shifts", null, {
      params: attendanceDate ? { attendance_date: attendanceDate } : undefined,
    });
    return res.data;
  },
};

export default staffService;
