import api from "@/api/client";
import type {
  BankAccount,
  BankAccountCreate,
  CashDepositRequest,
  BankTransaction,
  LiquidFundsSummary,
} from "../types/bankAccount";

class BankAccountService {
  async getBankAccounts(): Promise<BankAccount[]> {
    const res = await api.get<BankAccount[]>("/v1/bank-accounts");
    return res.data;
  }

  async getLiquidFundsSummary(): Promise<LiquidFundsSummary> {
    const res = await api.get<LiquidFundsSummary>("/v1/bank-accounts/summary");
    return res.data;
  }

  async createBankAccount(data: BankAccountCreate): Promise<BankAccount> {
    const res = await api.post<BankAccount>("/v1/bank-accounts", data);
    return res.data;
  }

  async depositCashToBank(data: CashDepositRequest): Promise<{ status: string; message: string }> {
    const res = await api.post<{ status: string; message: string }>("/v1/bank-accounts/deposit-cash", data);
    return res.data;
  }

  async transferBetweenBanks(data: {
    from_bank_account_uuid: string;
    to_bank_account_uuid: string;
    amount: number;
    transfer_date: string;
    reference_number?: string;
    remarks?: string;
  }): Promise<{ status: string; message: string }> {
    const res = await api.post<{ status: string; message: string }>("/v1/bank-accounts/transfer", data);
    return res.data;
  }

  async withdrawToCash(data: {
    bank_account_uuid: string;
    amount: number;
    withdrawal_date: string;
    reference_number?: string;
    remarks?: string;
  }): Promise<{ status: string; message: string }> {
    const res = await api.post<{ status: string; message: string }>("/v1/bank-accounts/withdraw-cash", data);
    return res.data;
  }

  async getTransactions(limit = 50): Promise<BankTransaction[]> {
    const res = await api.get<BankTransaction[]>("/v1/bank-accounts/transactions", {
      params: { limit },
    });
    return res.data;
  }

  async updateBankAccount(
    uuid: string,
    data: {
      account_name?: string;
      bank_name?: string;
      account_number?: string;
      ifsc_code?: string;
      account_type?: string;
    }
  ): Promise<BankAccount> {
    const res = await api.patch<BankAccount>(`/v1/bank-accounts/${uuid}`, data);
    return res.data;
  }

  async reconcileCsv(
    uuid: string,
    csvText: string
  ): Promise<{
    bank_account_uuid: string;
    account_name: string;
    matched_count: number;
    unmatched_credits_count: number;
    unmatched_debits_count: number;
    matched: Array<{ date: string; description: string; reference: string; amount: number; matched_remarks?: string }>;
    unmatched_credits: Array<{ date: string; description: string; reference: string; amount: number }>;
    unmatched_debits: Array<{ date: string; description: string; reference: string; amount: number }>;
  }> {
    const res = await api.post(`/v1/bank-accounts/${uuid}/reconcile`, { csv_text: csvText });
    return res.data;
  }

  async deleteBankAccount(uuid: string): Promise<void> {
    await api.delete(`/v1/bank-accounts/${uuid}`);
  }
}

const bankAccountService = new BankAccountService();
export default bankAccountService;
