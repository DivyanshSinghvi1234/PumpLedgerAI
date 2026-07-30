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

  async getTransactions(limit = 50): Promise<BankTransaction[]> {
    const res = await api.get<BankTransaction[]>("/v1/bank-accounts/transactions", {
      params: { limit },
    });
    return res.data;
  }

  async deleteBankAccount(uuid: string): Promise<void> {
    await api.delete(`/v1/bank-accounts/${uuid}`);
  }
}

const bankAccountService = new BankAccountService();
export default bankAccountService;
