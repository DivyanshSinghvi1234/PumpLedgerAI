import api from "../../../api/client";

export interface DailySnapshot {
  date: string;
  is_locked: boolean;
  closing_uuid: string | null;
  meters: {
    gross_meter_sales: number;
    total_liters: number;
    missing_nozzles: string[];
    nozzle_count: number;
  };
  vouchers: {
    cash_sales: number;
    upi_sales: number;
    card_sales: number;
    bank_sales: number;
    credit_sales: number;
    total_voucher_sales: number;
    unbilled_cash_fuel: number;
    meter_vs_voucher_gap: number;
  };
  cash_proof: {
    opening_float: number;
    cash_fuel_sales: number;
    cash_other_income: number;
    cash_payments_received: number;
    cash_expenses: number;
    cash_bank_deposits: number;
    cash_to_next_day: number;
    expected_drawer_cash: number;
    counted_notes_total: number;
    variance: number;
    denom_source: string;
    denominations: {
      notes_500: number;
      notes_200: number;
      notes_100: number;
      notes_50: number;
      notes_20: number;
      notes_10: number;
      coins: number;
    };
  };
  digital_collections: {
    voucher_upi: number;
    voucher_card: number;
    voucher_bank: number;
    credit_payments_digital: number;
    total_digital: number;
  };
  shift_settlement: {
    count: number;
    total_variance: number;
    latest_uuid: string | null;
  };
  profit?: {
    fuel_revenue: number;
    fuel_liters: number;
    fuel_gross_margin: number;
    commission_profit: number;
    margin_source: string;
    other_income: number;
    total_expenses: number;
    net_profit: number;
  };
  bank_reconciliation: Array<{
    bank_account_uuid: string;
    bank_name: string;
    account_name: string;
    opening_balance: number;
    inflows: number;
    outflows: number;
    closing_balance: number;
    transactions: Array<{
      uuid: string;
      type: string;
      amount: number;
      reference_number: string | null;
      remarks: string | null;
    }>;
  }>;
}

export interface FivePointAuditCheck {
  id: string;
  title: string;
  status: "OK" | "MISMATCH";
  expected: number;
  actual: number;
  difference: number;
  message: string;
  fix_action: string | null;
  fix_label: string | null;
  details?: unknown[];
}

export interface FivePointAuditResult {
  date: string;
  mismatch_count: number;
  all_clear: boolean;
  checks: FivePointAuditCheck[];
}

export interface PreLockCheckResult {
  date: string;
  can_lock: boolean;
  variance: number;
  checkpoints: Array<{
    id: string;
    title: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface BooksHealthResult {
  total_issues: number;
  issues: Array<{
    id: string;
    title: string;
    count: number;
    severity: "HIGH" | "MEDIUM" | "OK";
    fix_action: string | null;
    items: Record<string, unknown>[];
  }>;
}

export interface TimelineEvent {
  id: string;
  uuid: string;
  timestamp: string;
  category: string;
  direction: "IN" | "OUT" | "CREDIT";
  mode: string;
  amount: number;
  title: string;
  subtitle: string;
  bank_account_id: number | null;
}

export interface PreExportAuditResult {
  ready: boolean;
  checks: Array<{
    id: string;
    title: string;
    count: number;
    passed: boolean;
    dates?: string[];
    fuels?: string[];
  }>;
}

export const pipelineService = {
  getSnapshot: async (targetDate?: string): Promise<DailySnapshot> => {
    const res = await api.get("/pipeline/snapshot", {
      params: targetDate ? { target_date: targetDate } : undefined,
    });
    return res.data;
  },

  get5PointAudit: async (targetDate?: string): Promise<FivePointAuditResult> => {
    const res = await api.get("/pipeline/audit-5-point", {
      params: targetDate ? { target_date: targetDate } : undefined,
    });
    return res.data;
  },

  getPreLockCheck: async (params: {
    target_date?: string;
    notes?: string;
    responsible_employee_id?: number;
    physical_cash_counted?: number;
    cash_to_next_day?: number;
  }): Promise<PreLockCheckResult> => {
    const res = await api.get("/pipeline/pre-lock-check", { params });
    return res.data;
  },

  autoBalanceCash: async (targetDate?: string) => {
    const res = await api.post("/pipeline/auto-balance-cash", null, {
      params: targetDate ? { target_date: targetDate } : undefined,
    });
    return res.data;
  },

  getBooksHealth: async (): Promise<BooksHealthResult> => {
    const res = await api.get("/pipeline/books-health");
    return res.data;
  },

  recalculateBalances: async (customerUuid?: string) => {
    const res = await api.post("/pipeline/recalculate-balances", {
      customer_uuid: customerUuid ?? null,
    });
    return res.data;
  },

  fixLegacyEntries: async (bankAccountUuid?: string, onDate?: string) => {
    const res = await api.post("/pipeline/fix-legacy", {
      bank_account_uuid: bankAccountUuid ?? null,
      on_date: onDate ?? null,
    });
    return res.data;
  },

  getPreExportAudit: async (
    startDate: string,
    endDate: string
  ): Promise<PreExportAuditResult> => {
    const res = await api.get("/pipeline/pre-export-audit", {
      params: { start_date: startDate, end_date: endDate },
    });
    return res.data;
  },

  getTimeline: async (
    targetDate?: string
  ): Promise<{ date: string; count: number; events: TimelineEvent[] }> => {
    const res = await api.get("/pipeline/timeline", {
      params: targetDate ? { target_date: targetDate } : undefined,
    });
    return res.data;
  },

  matchDayClosing: async (closingDate: string, bankAccountUuid?: string) => {
    const res = await api.post("/bank-accounts/match-day-closing", null, {
      params: {
        closing_date: closingDate,
        ...(bankAccountUuid ? { bank_account_uuid: bankAccountUuid } : {}),
      },
    });
    return res.data;
  },
};
