export interface BankAccount {
  uuid: string;
  account_name: string;
  bank_name: string;
  account_number?: string;
  ifsc_code?: string;
  account_type: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankAccountCreate {
  account_name: string;
  bank_name: string;
  account_number?: string;
  ifsc_code?: string;

  account_type?: string;
  opening_balance?: number;
}

export interface CashDepositRequest {
  bank_account_uuid: string;
  amount: number;
  deposit_date: string;
  reference_number?: string;
  remarks?: string;
}

export interface BankTransaction {
  uuid: string;
  bank_account_uuid?: string;
  bank_account_name?: string;
  transaction_type: string; // DEPOSIT, WITHDRAWAL, INCOME, EXPENSE, TRANSFER, OPENING_BALANCE
  amount: number;
  transaction_date: string;
  reference_number?: string;
  remarks?: string;
  created_at: string;
}

export interface LiquidFundsSummary {
  total_cash_available: number;
  total_bank_balance: number;
  total_liquid_funds: number;
  accounts: BankAccount[];
}
