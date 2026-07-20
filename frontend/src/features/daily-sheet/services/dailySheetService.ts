import api from "@/api/client";

export type ExpenseType = "expense" | "income";
export type ExpensePaymentMode = "cash" | "upi" | "card" | "credit";

export interface DailySheetExpense {
  category: string;
  description: string;
  amount: number;
  // Optional + defaulted on the backend so sheets saved before this change
  // still parse. "income" adds to the mode total, "expense" subtracts.
  type?: ExpenseType;
  payment_mode?: ExpensePaymentMode;
}

export interface DailySheetPaymentModeAmounts {
  cash: number;
  upi: number;
  card: number;
  credit: number;
}

export interface DailySheet {
  id: number;
  uuid: string;
  date: string;
  manual_sheet_image: string | null;
  remarks: string | null;
  period_start: string | null;
  period_end: string | null;
  actual_cash_collected: number | null;
  cash_shortage_excess: number | null;
  expenses_data: string | null;
  manual_payment_mode_amounts_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationTankRow {
  tank_uuid: string;
  tank_name: string;
  fuel_type: string;
  opening_dip_liters: number;
  deliveries_liters: number;
  closing_dip_liters: number;
  dip_sales_liters: number;
  nozzle_sales_liters: number;
  voucher_sales_liters: number;
  unbilled_cash_variance: number;
  physical_leak_variance: number;
  net_stock_variance: number;
  tolerance_liters: number;
  requires_review: boolean;
}

export interface DailyReconciliation {
  date: string;
  tanks: ReconciliationTankRow[];
  billed_amount_by_mode: Record<string, number>;
  manual_payment_mode_amounts: DailySheetPaymentModeAmounts;
  recorded_amount_by_mode: Record<string, number>;
  total_billed_amount: number;
  payments_collected: number;
  credit_given: number;
  gross_fuel_sales: number;
  credit_sales: number;
  digital_sales: number;
  cash_vouchers_sales: number;
  total_expenses: number;
  expected_cash_handover: number;
  actual_cash_collected: number | null;
  cash_shortage_excess: number | null;
  expenses: DailySheetExpense[];
}

export const dailySheetService = {
  async getDailySheet(date: string): Promise<DailySheet | null> {
    try {
      const response = await api.get<DailySheet>(`/v1/daily-sheets/${date}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async listDailySheets(): Promise<DailySheet[]> {
    const response = await api.get<DailySheet[]>("/v1/daily-sheets");
    return response.data;
  },

  async createDailySheet(
    date: string,
    options?: {
      remarks?: string;
      period_start?: string; // ISO 8601
      period_end?: string;   // ISO 8601
      actual_cash_collected?: number;
      expenses?: DailySheetExpense[];
      manual_payment_mode_amounts?: DailySheetPaymentModeAmounts;
    }
  ): Promise<DailySheet> {
    const response = await api.post<DailySheet>("/v1/daily-sheets", {
      date,
      remarks: options?.remarks,
      period_start: options?.period_start ?? null,
      period_end: options?.period_end ?? null,
      actual_cash_collected: options?.actual_cash_collected,
      expenses: options?.expenses,
      manual_payment_mode_amounts: options?.manual_payment_mode_amounts,
    });
    return response.data;
  },

  async updateDailySheet(
    uuid: string,
    options: {
      remarks?: string;
      manual_sheet_image?: string;
      date?: string;
      period_start?: string; // ISO 8601
      period_end?: string;   // ISO 8601
      actual_cash_collected?: number | null;
      expenses?: DailySheetExpense[];
      manual_payment_mode_amounts?: DailySheetPaymentModeAmounts;
    }
  ): Promise<DailySheet> {
    const response = await api.put<DailySheet>(`/v1/daily-sheets/${uuid}`, {
      remarks: options.remarks,
      manual_sheet_image: options.manual_sheet_image,
      date: options.date,
      period_start: options.period_start,
      period_end: options.period_end,
      actual_cash_collected: options.actual_cash_collected,
      expenses: options.expenses,
      manual_payment_mode_amounts: options.manual_payment_mode_amounts,
    });
    return response.data;
  },

  async uploadManualSheet(uuid: string, file: File): Promise<DailySheet> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<DailySheet>(
      `/v1/daily-sheets/${uuid}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  async getReconciliation(date: string): Promise<DailyReconciliation> {
    const response = await api.get<DailyReconciliation>(
      `/v1/daily-sheets/${date}/reconciliation`,
    );
    return response.data;
  },

  getBaseUrl(): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
    return baseUrl ? `${baseUrl}/storage/` : "/storage/";
  },

  /**
   * Resolve a stored manual-sheet image reference to a browser URL.
   *
   * Handles three shapes:
   *  - Absolute B2/R2 URL (production) → used verbatim.
   *  - A `storage/…` rooted local path → served by the /storage mount.
   *  - A bare relative path like `daily-sheets/x.jpg` (legacy) → prefixed
   *    with the /storage base.
   */
  resolveImageUrl(path: string | null | undefined): string | null {
    if (!path) return null;

    // Remote object storage returns a full URL — use as-is.
    if (/^https?:\/\//i.test(path)) return path;

    // Normalize Windows backslashes and strip any leading ./ or /
    let p = path.replace(/\\/g, "/").replace(/^\.?\//, "");

    const baseUrl = import.meta.env.VITE_API_BASE_URL || "";

    // If the path already contains the storage segment, root it there.
    const idx = p.indexOf("storage/");
    if (idx >= 0) {
      p = p.slice(idx);
      return baseUrl ? `${baseUrl}/${p}` : `/${p}`;
    }

    // Bare relative path (e.g. "daily-sheets/x.jpg") → mount under /storage.
    return baseUrl ? `${baseUrl}/storage/${p}` : `/storage/${p}`;
  },
};

export default dailySheetService;
