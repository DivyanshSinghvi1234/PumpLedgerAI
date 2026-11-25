import api from "@/api/client";

export interface RecurringExpenseItem {
  uuid: string;
  title: string;
  category: string;
  amount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  due_day: number | null;
  payment_mode: string;
  bank_account_uuid: string | null;
  next_due_date: string;
  last_posted_date: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface RecurringExpenseCreateInput {
  title: string;
  category: string;
  amount: number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  payment_mode: string;
  bank_account_uuid?: string | null;
  next_due_date: string;
  notes?: string | null;
}

const recurringExpenseService = {
  async listAll(): Promise<RecurringExpenseItem[]> {
    const res = await api.get<RecurringExpenseItem[]>("/v1/recurring-expenses");
    return res.data;
  },

  async listDue(asOf?: string): Promise<RecurringExpenseItem[]> {
    const res = await api.get<RecurringExpenseItem[]>("/v1/recurring-expenses/due", {
      params: asOf ? { as_of: asOf } : undefined,
    });
    return res.data;
  },

  async create(data: RecurringExpenseCreateInput): Promise<RecurringExpenseItem> {
    const res = await api.post<RecurringExpenseItem>("/v1/recurring-expenses", data);
    return res.data;
  },

  async remove(uuid: string): Promise<void> {
    await api.delete(`/v1/recurring-expenses/${uuid}`);
  },

  async postOne(uuid: string, payload?: { post_date?: string; amount_override?: number }) {
    const res = await api.post(`/v1/recurring-expenses/${uuid}/post`, payload ?? {});
    return res.data;
  },

  async postAllDue(asOf?: string): Promise<{ posted_count: number; total_amount: number }> {
    const res = await api.post("/v1/recurring-expenses/post-all-due", null, {
      params: asOf ? { as_of: asOf } : undefined,
    });
    return res.data;
  },
};

export default recurringExpenseService;
