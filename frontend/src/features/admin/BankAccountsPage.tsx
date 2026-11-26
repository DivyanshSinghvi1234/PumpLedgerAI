import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Landmark,
  Plus,
  ArrowUpRight,
  Wallet,
  Building2,
  TrendingUp,
  Receipt,
  ArrowRightLeft,
  ArrowDownLeft,
  Pencil,
  Trash2,
  FileSpreadsheet,
  Smartphone,
} from "lucide-react";

import BankAccountSelect from "@/components/common/BankAccountSelect";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import api from "@/api/client";

import PageHeader from "@/components/common/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import bankAccountService, { type UpiAccount } from "./services/bankAccountService";
import type { BankAccountCreate, CashDepositRequest } from "./types/bankAccount";
import { formatCurrency } from "@/lib/utils";

export default function BankAccountsPage() {
  const queryClient = useQueryClient();

  const [addBankOpen, setAddBankOpen] = useState(false);
  const [depositCashOpen, setDepositCashOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Transfer & Withdrawal State
  const [fromBankUuid, setFromBankUuid] = useState("");
  const [toBankUuid, setToBankUuid] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRemarks, setTransferRemarks] = useState("");
  const [withdrawBankUuid, setWithdrawBankUuid] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawRemarks, setWithdrawRemarks] = useState("");

  // Edit Bank State
  const [editBankOpen, setEditBankOpen] = useState(false);
  const [editingBankUuid, setEditingBankUuid] = useState("");
  const [editAccName, setEditAccName] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editAccNum, setEditAccNum] = useState("");
  const [editIfsc, setEditIfsc] = useState("");
  const [editAccType, setEditAccType] = useState("CURRENT");

  // Reconcile CSV State
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileBankUuid, setReconcileBankUuid] = useState("");
  const [csvText, setCsvText] = useState("");
  const [reconcileResult, setReconcileResult] = useState<Awaited<ReturnType<typeof bankAccountService.reconcileCsv>> | null>(null);
  const [reconcilePayRowIdx, setReconcilePayRowIdx] = useState<number | null>(null);
  const [reconcileCustName, setReconcileCustName] = useState("");
  const [reconcileCustUuid, setReconcileCustUuid] = useState("");

  // UPI Accounts State
  const [upiDialogOpen, setUpiDialogOpen] = useState(false);
  const [editingUpi, setEditingUpi] = useState<UpiAccount | null>(null);
  const [upiName, setUpiName] = useState("");
  const [upiProvider, setUpiProvider] = useState("PHONEPE");
  const [upiId, setUpiId] = useState("");
  const [upiBankUuid, setUpiBankUuid] = useState("");

  const { data: upiAccounts } = useQuery({
    queryKey: ["upi-accounts"],
    queryFn: () => bankAccountService.getUpiAccounts(),
  });

  const saveUpiMutation = useMutation({
    mutationFn: () => {
      if (editingUpi) {
        return bankAccountService.updateUpiAccount(editingUpi.uuid, {
          name: upiName.trim(),
          provider: upiProvider,
          upi_id: upiId.trim() || null,
          bank_account_uuid: upiBankUuid,
        });
      }
      return bankAccountService.createUpiAccount({
        name: upiName.trim(),
        provider: upiProvider,
        upi_id: upiId.trim() || null,
        bank_account_uuid: upiBankUuid,
      });
    },
    onSuccess: () => {
      toast.success(editingUpi ? "UPI account updated!" : "UPI account added!");
      queryClient.invalidateQueries({ queryKey: ["upi-accounts"] });
      setUpiDialogOpen(false);
      setEditingUpi(null);
      setUpiName("");
      setUpiProvider("PHONEPE");
      setUpiId("");
      setUpiBankUuid("");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to save UPI account."),
  });

  const deleteUpiMutation = useMutation({
    mutationFn: (uuid: string) => bankAccountService.deleteUpiAccount(uuid),
    onSuccess: () => {
      toast.success("UPI account removed.");
      queryClient.invalidateQueries({ queryKey: ["upi-accounts"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to delete UPI account."),
  });

  // New Bank Form State
  const [accountName, setAccountName] = useState("Main Current Account");
  const [bankName, setBankName] = useState("ICICI Bank");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState("CURRENT");
  const [openingBalance, setOpeningBalance] = useState("0");

  // Cash Deposit Form State
  const [depositBankUuid, setDepositBankUuid] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [refNumber, setRefNumber] = useState("");
  const [depositRemarks, setDepositRemarks] = useState("");

  // Queries
  const { data: summary, isLoading, isError } = useQuery({

    queryKey: ["bank-accounts-summary"],
    queryFn: () => bankAccountService.getLiquidFundsSummary(),
  });

  const { data: transactions } = useQuery({
    queryKey: ["bank-transactions"],
    queryFn: () => bankAccountService.getTransactions(50),
  });

  // Mutations
  const createBankMutation = useMutation({
    mutationFn: (data: BankAccountCreate) => bankAccountService.createBankAccount(data),
    onSuccess: () => {
      toast.success("Bank Account added successfully!");
      setAddBankOpen(false);
      setAccountNumber("");
      setIfscCode("");
      setOpeningBalance("0");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to add bank account.");
    },
  });

  const depositMutation = useMutation({
    mutationFn: (data: CashDepositRequest) => bankAccountService.depositCashToBank(data),
    onSuccess: (res) => {
      toast.success(res.message);
      setDepositCashOpen(false);
      setDepositAmount("");
      setRefNumber("");
      setDepositRemarks("");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to process cash deposit.");
    },
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      bankAccountService.transferBetweenBanks({
        from_bank_account_uuid: fromBankUuid,
        to_bank_account_uuid: toBankUuid,
        amount: Number(transferAmount),
        transfer_date: new Date().toISOString().split("T")[0],
        remarks: transferRemarks.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setTransferOpen(false);
      setTransferAmount("");
      setTransferRemarks("");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to transfer funds.");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () =>
      bankAccountService.withdrawToCash({
        bank_account_uuid: withdrawBankUuid,
        amount: Number(withdrawAmount),
        withdrawal_date: new Date().toISOString().split("T")[0],
        remarks: withdrawRemarks.trim() || undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message);
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawRemarks("");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to withdraw cash.");
    },
  });

  const updateBankMutation = useMutation({
    mutationFn: () =>
      bankAccountService.updateBankAccount(editingBankUuid, {
        account_name: editAccName.trim(),
        bank_name: editBankName.trim(),
        account_number: editAccNum.trim() || undefined,
        ifsc_code: editIfsc.trim() || undefined,
        account_type: editAccType,
      }),
    onSuccess: () => {
      toast.success("Bank account updated.");
      setEditBankOpen(false);
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to update bank account."),
  });

  const deleteBankMutation = useMutation({
    mutationFn: (uuid: string) => bankAccountService.deleteBankAccount(uuid),
    onSuccess: () => {
      toast.success("Bank account removed.");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to delete bank account."),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => bankAccountService.reconcileCsv(reconcileBankUuid, csvText),
    onSuccess: (res) => {
      setReconcileResult(res);
      toast.success(`Reconciled: ${res.matched_count} matched, ${res.unmatched_credits_count + res.unmatched_debits_count} unmatched.`);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to reconcile CSV."),
  });

  const reverseTxnMutation = useMutation({
    mutationFn: (txnUuid: string) => bankAccountService.reverseTransaction(txnUuid),
    onSuccess: () => {
      toast.success("Bank transaction reversed and balance updated.");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to reverse transaction."),
  });

  const postReconcilePaymentMutation = useMutation({
    mutationFn: async (row: { idx: number; amount: number; date: string; description: string; reference: string }) => {
      await api.post("/v1/payments", {
        customer_uuid: reconcileCustUuid,
        amount: row.amount,
        payment_mode: "BANK",
        bank_account_uuid: reconcileBankUuid,
        payment_date: row.date || new Date().toISOString().split("T")[0],
        reference_number: row.reference || null,
        remarks: `Reconciled CSV: ${row.description}`,
        auto_allocate_fifo: true,
      });
      return row.idx;
    },
    onSuccess: (idx) => {
      toast.success("Customer payment recorded (FIFO) & bank synced!");
      setReconcilePayRowIdx(null);
      setReconcileCustName("");
      setReconcileCustUuid("");
      setReconcileResult((prev) => {
        if (!prev) return prev;
        const nextCredits = prev.unmatched_credits.filter((_, i) => i !== idx);
        return {
          ...prev,
          matched_count: prev.matched_count + 1,
          unmatched_credits_count: nextCredits.length,
          unmatched_credits: nextCredits,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to post customer payment."),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank & Cash Accounts"
        description="Manage station bank accounts, track forecourt liquid cash available, and record cash-to-bank deposits."
        helpText="Add your pump's bank accounts (HDFC, SBI, ICICI) here. Whenever you deposit cash, pay for tanker deliveries, or record customer bank/UPI payments, balances update automatically."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <details className="relative">
              <summary className="list-none inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 h-9 text-xs font-bold text-ink hover:bg-surface-3 cursor-pointer select-none">
                More Actions ▾
              </summary>
              <div className="absolute right-0 mt-1.5 w-48 rounded-lg border border-hairline bg-surface-1 shadow-xl p-1.5 z-30 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setReconcileResult(null);
                    setReconcileOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-3 cursor-pointer"
                >
                  <FileSpreadsheet size={14} className="text-emerald-400" /> Reconcile CSV
                </button>
                <button
                  type="button"
                  onClick={() => setTransferOpen(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-3 cursor-pointer"
                >
                  <ArrowRightLeft size={14} className="text-blue-400" /> Bank-to-Bank
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawOpen(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-3 cursor-pointer"
                >
                  <ArrowDownLeft size={14} className="text-amber-400" /> Withdraw Cash
                </button>
              </div>
            </details>
            <Button
              onClick={() => setDepositCashOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 cursor-pointer shadow-md"
            >
              <ArrowUpRight size={16} className="mr-1.5" /> Deposit Cash to Bank
            </Button>
            <Button
              onClick={() => setAddBankOpen(true)}
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer shadow-md"
            >
              <Plus size={16} className="mr-1.5" /> Add Bank Account
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-ink-subtle flex items-center justify-between">
              Total Cash Available
              <Wallet size={18} className="text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {formatCurrency(summary?.total_cash_available || 0)}
            </div>
            <p className="text-[11px] text-ink-subtle mt-1">
              Forecourt register & safe cash drawer
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-ink-subtle flex items-center justify-between">
              Total Bank Balances
              <Landmark size={18} className="text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400 font-mono">
              {formatCurrency(summary?.total_bank_balance || 0)}
            </div>
            <p className="text-[11px] text-ink-subtle mt-1">
              Across {summary?.accounts?.length || 0} active bank accounts
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-hairline bg-surface-2/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-ink-subtle flex items-center justify-between">
              Combined Liquid Funds
              <TrendingUp size={18} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {formatCurrency(summary?.total_liquid_funds || 0)}
            </div>
            <p className="text-[11px] text-ink-subtle mt-1">
              Cash drawer + Total bank deposits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Account Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Building2 size={16} className="text-blue-400" /> Connected Bank Accounts
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-ink-subtle animate-pulse">Loading bank accounts...</div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-red-400">Failed to load bank accounts summary.</div>
        ) : !summary?.accounts || summary.accounts.length === 0 ? (
          <Card className="glass p-8 text-center text-xs text-ink-subtle italic">
            No bank accounts created yet. Click "Add Bank Account" to add ICICI, SBI, HDFC or Axis Bank.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.accounts.map((acc) => (
              <Card key={acc.uuid} className="glass border-hairline hover:border-blue-500/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-blue-500/15 text-blue-400 border-transparent font-bold text-[10px]">
                      {acc.bank_name}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-ink-subtle uppercase">{acc.account_type}</span>
                    </div>
                  </div>
                  <CardTitle className="text-sm font-bold text-ink mt-1.5">{acc.account_name}</CardTitle>
                  <CardDescription className="text-xs font-mono text-ink-subtle">
                    {acc.account_number ? `A/C: ****${acc.account_number.slice(-4)}` : "A/C: N/A"} {acc.ifsc_code ? `| IFSC: ${acc.ifsc_code}` : ""}
                  </CardDescription>

                </CardHeader>
                <CardContent className="pt-2 border-t border-hairline flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-ink-subtle uppercase font-mono block">Current Balance</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {formatCurrency(acc.current_balance)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingBankUuid(acc.uuid);
                        setEditAccName(acc.account_name);
                        setEditBankName(acc.bank_name);
                        setEditAccNum(acc.account_number || "");
                        setEditIfsc(acc.ifsc_code || "");
                        setEditAccType(acc.account_type);
                        setEditBankOpen(true);
                      }}
                      className="h-8 text-xs border-hairline text-ink hover:bg-surface-3 cursor-pointer"
                    >
                      <Pencil size={13} className="mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`Delete bank account "${acc.account_name}"?`)) {
                          deleteBankMutation.mutate(acc.uuid);
                        }
                      }}
                      className="h-8 text-xs border-hairline text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 size={13} className="mr-1" /> Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDepositBankUuid(acc.uuid);
                        setDepositCashOpen(true);
                      }}
                      className="h-8 text-xs border-hairline text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                    >
                      Deposit Cash
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* UPI Accounts & QR Handles Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink flex items-center gap-2">
            <Smartphone size={16} className="text-emerald-400" /> UPI Accounts &amp; QR Handles (Linked to Banks)
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingUpi(null);
              setUpiName("");
              setUpiProvider("PHONEPE");
              setUpiId("");
              setUpiBankUuid(summary?.accounts?.[0]?.uuid || "");
              setUpiDialogOpen(true);
            }}
            className="h-8 text-xs border-hairline text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
          >
            <Plus size={14} className="mr-1" /> Add UPI Account
          </Button>
        </div>

        {!upiAccounts || upiAccounts.length === 0 ? (
          <Card className="glass p-6 text-center text-xs text-ink-subtle italic">
            No UPI accounts added yet. Add PhonePe, Paytm, or GPay handles and link each to HDFC, SBI, etc.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upiAccounts.map((u) => (
              <Card key={u.uuid} className="glass border-hairline hover:border-emerald-500/40 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-transparent font-bold text-[10px]">
                      {u.provider}
                    </Badge>
                    <span className="text-[10px] font-mono text-ink-subtle">
                      → {u.bank_name}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-bold text-ink mt-1.5">{u.name}</CardTitle>
                  <CardDescription className="text-xs font-mono text-ink-subtle">
                    {u.upi_id ? `UPI ID: ${u.upi_id}` : "No VPA set"} · Linked: {u.bank_account_name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2 border-t border-hairline flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingUpi(u);
                      setUpiName(u.name);
                      setUpiProvider(u.provider);
                      setUpiId(u.upi_id || "");
                      setUpiBankUuid(u.bank_account_uuid);
                      setUpiDialogOpen(true);
                    }}
                    className="h-8 text-xs border-hairline text-ink hover:bg-surface-3 cursor-pointer"
                  >
                    <Pencil size={13} className="mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(`Delete UPI account "${u.name}"?`)) {
                        deleteUpiMutation.mutate(u.uuid);
                      }
                    }}
                    className="h-8 text-xs border-hairline text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 size={13} className="mr-1" /> Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Bank Transactions Table */}
      <Card className="glass border-hairline overflow-hidden">
        <CardHeader className="bg-surface-2/60 border-b border-hairline py-4">
          <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
            <Receipt size={16} className="text-fuel-amber" /> Bank & Cash Movement Transactions Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!transactions || transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-subtle italic">No bank transactions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-hairline hover:bg-transparent">
                    <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Date</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Bank Account</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Type</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Ref / Remarks</TableHead>
                    <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">Amount</TableHead>
                    <TableHead className="px-4 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                      <TableCell className="px-5 text-xs text-ink-muted font-mono">
                        {new Date(t.transaction_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </TableCell>
                      <TableCell className="text-xs text-ink font-semibold">
                        {t.bank_account_name || "Forecourt Cash Drawer"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge
                          className={`text-[9px] font-bold ${
                            t.transaction_type === "DEPOSIT"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : t.transaction_type === "INCOME"
                              ? "bg-blue-500/15 text-blue-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {t.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-ink-subtle">
                        {t.remarks} {t.reference_number ? `(Ref: ${t.reference_number})` : ""}
                      </TableCell>
                      <TableCell className="px-5 text-right text-xs font-mono font-bold text-ink">
                        {formatCurrency(t.amount)}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <button
                          type="button"
                          disabled={reverseTxnMutation.isPending}
                          onClick={() => {
                            if (window.confirm("Reverse this bank transaction and restore the account balance?")) {
                              reverseTxnMutation.mutate(t.uuid);
                            }
                          }}
                          className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                        >
                          Reverse
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Bank Account Dialog */}
      <Dialog open={addBankOpen} onOpenChange={setAddBankOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <Landmark size={18} className="text-blue-500" /> Add Bank Account
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Link a new bank account (ICICI, SBI, HDFC, Axis, etc.) to record payments and deposits
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!bankName.trim() || !accountName.trim()) {
                toast.error("Please enter Bank Name and Account Label.");
                return;
              }
              createBankMutation.mutate({
                account_name: accountName.trim(),
                bank_name: bankName.trim(),
                account_number: accountNumber.trim() || undefined,
                ifsc_code: ifscCode.trim() || undefined,
                account_type: accountType,
                opening_balance: parseFloat(openingBalance) || 0,
              });

            }}
            className="space-y-3 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Bank Name</Label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="ICICI Bank">ICICI Bank</option>
                  <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                  <option value="HDFC Bank">HDFC Bank</option>
                  <option value="Axis Bank">Axis Bank</option>
                  <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                  <option value="Bank of Baroda">Bank of Baroda</option>
                  <option value="Punjab National Bank">Punjab National Bank</option>
                  <option value="Canara Bank">Canara Bank</option>
                  <option value="Other Bank">Other Bank</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Account Label</Label>
                <Input
                  placeholder="e.g. Main Current A/C"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Account Number <span className="font-normal text-ink-subtle">(optional)</span></Label>
                <Input
                  placeholder="e.g. 9180100998822"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs font-mono text-ink"
                />
              </div>


              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">IFSC Code <span className="font-normal text-ink-subtle">(optional)</span></Label>
                <Input
                  placeholder="e.g. ICIC0001234"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs font-mono text-ink uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Account Type</Label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="CURRENT">Current Account</option>
                  <option value="SAVINGS">Savings Account</option>
                  <option value="OVERDRAFT">Overdraft (OD) Account</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Opening Balance (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs font-mono text-ink font-semibold"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button type="button" variant="ghost" onClick={() => setAddBankOpen(false)} className="text-xs h-9 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={createBankMutation.isPending} className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer">
                {createBankMutation.isPending ? "Saving..." : "Add Bank Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cash Deposit Dialog */}
      <Dialog open={depositCashOpen} onOpenChange={setDepositCashOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <ArrowUpRight size={18} className="text-emerald-500" /> Deposit Cash to Bank Account
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Transfer forecourt cash drawer money directly into station bank account
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!depositBankUuid) {
                toast.error("Please select a target bank account.");
                return;
              }
              const amt = parseFloat(depositAmount);
              if (isNaN(amt) || amt <= 0) {
                toast.error("Please enter a valid deposit amount.");
                return;
              }
              depositMutation.mutate({
                bank_account_uuid: depositBankUuid,
                amount: amt,
                deposit_date: depositDate,
                reference_number: refNumber.trim() || undefined,
                remarks: depositRemarks.trim() || undefined,
              });
            }}
            className="space-y-3 py-2"
          >
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Target Bank Account</Label>
              <select
                value={depositBankUuid}
                onChange={(e) => setDepositBankUuid(e.target.value)}
                className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink font-semibold outline-none"
                required
              >
                <option value="">-- Select Destination Bank --</option>
                {summary?.accounts?.map((acc) => (
                  <option key={acc.uuid} value={acc.uuid}>
                    {acc.bank_name} - {acc.account_name} ({acc.account_number ? `****${acc.account_number.slice(-4)}` : "N/A"})
                  </option>

                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Deposit Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50000.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs font-mono font-bold text-emerald-400"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Deposit Date</Label>
                <Input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Deposit Slip / Ref # <span className="font-normal text-ink-subtle">(optional)</span></Label>
                <Input
                  placeholder="e.g. SLIP-998811"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Remarks <span className="font-normal text-ink-subtle">(optional)</span></Label>
                <Input
                  placeholder="e.g. Daily cash deposit"
                  value={depositRemarks}
                  onChange={(e) => setDepositRemarks(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button type="button" variant="ghost" onClick={() => setDepositCashOpen(false)} className="text-xs h-9 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={depositMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 cursor-pointer">
                {depositMutation.isPending ? "Depositing..." : "Confirm Deposit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bank-to-Bank Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-blue-500" /> Bank-to-Bank Transfer
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Move funds between accounts (e.g. SBI UPI → HDFC Current) without affecting P&L.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              transferMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <BankAccountSelect value={fromBankUuid} onChange={setFromBankUuid} label="From Bank Account" required />
            <BankAccountSelect value={toBankUuid} onChange={setToBankUuid} label="To Bank Account" required />
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Remarks (optional)</Label>
              <Input
                value={transferRemarks}
                onChange={(e) => setTransferRemarks(e.target.value)}
                placeholder="e.g. Sweep UPI balance to OMC account"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setTransferOpen(false)} className="text-xs h-9">
                Cancel
              </Button>
              <Button type="submit" disabled={transferMutation.isPending} className="bg-blue-600 text-white text-xs h-9">
                {transferMutation.isPending ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Withdraw Bank to Cash Drawer Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <ArrowDownLeft size={16} className="text-amber-500" /> Withdraw Bank to Cash Drawer
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Deducts from bank and adds to Forecourt Cash-in-Hand without affecting P&L.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              withdrawMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <BankAccountSelect value={withdrawBankUuid} onChange={setWithdrawBankUuid} label="From Bank Account" required />
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Remarks (optional)</Label>
              <Input
                value={withdrawRemarks}
                onChange={(e) => setWithdrawRemarks(e.target.value)}
                placeholder="e.g. Cash float for forecourt expenses"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setWithdrawOpen(false)} className="text-xs h-9">
                Cancel
              </Button>
              <Button type="submit" disabled={withdrawMutation.isPending} className="bg-amber-600 text-white text-xs h-9">
                {withdrawMutation.isPending ? "Withdrawing..." : "Confirm Withdrawal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Bank Account Dialog */}
      <Dialog open={editBankOpen} onOpenChange={setEditBankOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink">Edit Bank Account</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateBankMutation.mutate();
            }}
            className="space-y-3 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Account Label *</Label>
                <Input value={editAccName} onChange={(e) => setEditAccName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Bank Name *</Label>
                <Input value={editBankName} onChange={(e) => setEditBankName(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Account Number</Label>
                <Input value={editAccNum} onChange={(e) => setEditAccNum(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">IFSC Code</Label>
                <Input value={editIfsc} onChange={(e) => setEditIfsc(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Account Type</Label>
              <select
                value={editAccType}
                onChange={(e) => setEditAccType(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              >
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
                <option value="OD">Overdraft (OD / CC)</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditBankOpen(false)} className="text-xs h-9">
                Cancel
              </Button>
              <Button type="submit" disabled={updateBankMutation.isPending} className="bg-blue-600 text-white text-xs h-9">
                {updateBankMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bank Statement CSV Reconcile Dialog */}
      <Dialog open={reconcileOpen} onOpenChange={setReconcileOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-emerald-500" /> Bank Statement CSV Auto-Reconciler
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Upload or paste CSV (Date, Description, Credit, Debit) to match against recorded transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <BankAccountSelect value={reconcileBankUuid} onChange={setReconcileBankUuid} label="Select Bank Account" required />
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Upload CSV File or Paste Rows</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCsvText(await file.text());
                  }
                }}
                className="block w-full text-xs text-ink-muted"
              />
              <textarea
                rows={4}
                placeholder="Date,Description,Credit,Debit&#10;2026-11-26,UPI Settlement,12500,0"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-xs font-mono text-ink"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={!reconcileBankUuid || !csvText.trim() || reconcileMutation.isPending}
                onClick={() => reconcileMutation.mutate()}
                className="bg-emerald-600 text-white text-xs h-9"
              >
                {reconcileMutation.isPending ? "Matching..." : "Run Auto-Match"}
              </Button>
            </div>

            {reconcileResult && (
              <div className="space-y-3 border-t border-hairline pt-3 text-xs">
                <div className="flex gap-3 font-semibold">
                  <span className="text-emerald-500">Matched: {reconcileResult.matched_count}</span>
                  <span className="text-amber-500">Unmatched Credits: {reconcileResult.unmatched_credits_count}</span>
                  <span className="text-rose-500">Unmatched Debits: {reconcileResult.unmatched_debits_count}</span>
                </div>
                {reconcileResult.unmatched_credits.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-bold text-amber-500">Unmatched Credits (click to record as Customer Payment):</p>
                    {reconcileResult.unmatched_credits.map((u, i) => (
                      <div key={i} className="rounded bg-amber-500/10 px-2.5 py-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>{u.date} · {u.description}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">+{formatCurrency(u.amount)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setReconcilePayRowIdx(reconcilePayRowIdx === i ? null : i);
                                setReconcileCustName("");
                                setReconcileCustUuid("");
                              }}
                              className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              Record as Payment →
                            </button>
                          </div>
                        </div>
                        {reconcilePayRowIdx === i && (
                          <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-amber-500/20">
                            <div className="flex-1 min-w-[200px]">
                              <CustomerAutocomplete
                                value={reconcileCustName}
                                customerUuid={reconcileCustUuid || null}
                                onChange={(name, uuid) => {
                                  setReconcileCustName(name);
                                  setReconcileCustUuid(uuid || "");
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!reconcileCustUuid || postReconcilePaymentMutation.isPending}
                              onClick={() => postReconcilePaymentMutation.mutate({ idx: i, ...u })}
                              className="bg-emerald-600 text-white text-xs h-8"
                            >
                              {postReconcilePaymentMutation.isPending ? "Saving..." : "Confirm Payment"}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {reconcileResult.unmatched_debits.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-bold text-rose-500">Unmatched Debits (missing in app):</p>
                    {reconcileResult.unmatched_debits.map((u, i) => (
                      <div key={i} className="flex justify-between rounded bg-rose-500/10 px-2.5 py-1.5">
                        <span>{u.date} · {u.description}</span>
                        <span className="font-mono font-bold">−{formatCurrency(u.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit UPI Account Dialog */}
      <Dialog open={upiDialogOpen} onOpenChange={setUpiDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <Smartphone size={16} className="text-emerald-400" />
              {editingUpi ? "Edit UPI Account" : "Add UPI Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Name your PhonePe, Paytm, or GPay handle and link it to a bank account so UPI receipts credit that bank automatically.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!upiName.trim() || !upiBankUuid) {
                toast.error("Please enter a name and select a linked bank account.");
                return;
              }
              saveUpiMutation.mutate();
            }}
            className="space-y-3 py-2"
          >
            <div className="space-y-1">
              <Label className="text-xs font-bold text-ink-muted">Display Name *</Label>
              <Input
                placeholder="e.g. Forecourt PhonePe QR / Office Paytm"
                value={upiName}
                onChange={(e) => setUpiName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">Provider *</Label>
                <select
                  value={upiProvider}
                  onChange={(e) => setUpiProvider(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
                >
                  <option value="PHONEPE">PhonePe</option>
                  <option value="PAYTM">Paytm</option>
                  <option value="GPAY">Google Pay (GPay)</option>
                  <option value="BHARATPE">BharatPe</option>
                  <option value="RAZORPAY">Razorpay QR</option>
                  <option value="OTHER">Other UPI</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-ink-muted">UPI ID / VPA (optional)</Label>
                <Input
                  placeholder="e.g. pump@ybl"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
            </div>
            <BankAccountSelect
              value={upiBankUuid}
              onChange={setUpiBankUuid}
              label="Linked Bank Account *"
              required
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setUpiDialogOpen(false)} className="text-xs h-9">
                Cancel
              </Button>
              <Button type="submit" disabled={saveUpiMutation.isPending} className="bg-emerald-600 text-white text-xs h-9">
                {saveUpiMutation.isPending ? "Saving..." : editingUpi ? "Save Changes" : "Add UPI Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
