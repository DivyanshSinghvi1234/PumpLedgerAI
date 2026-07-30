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
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import bankAccountService from "./services/bankAccountService";
import type { BankAccountCreate, CashDepositRequest } from "./types/bankAccount";
import { formatCurrency } from "@/lib/utils";

export default function BankAccountsPage() {
  const queryClient = useQueryClient();

  const [addBankOpen, setAddBankOpen] = useState(false);
  const [depositCashOpen, setDepositCashOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank & Cash Accounts"
        description="Manage station bank accounts, track forecourt liquid cash available, and record cash-to-bank deposits."
        action={
          <div className="flex items-center gap-2">
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
                    <span className="text-[10px] font-mono text-ink-subtle uppercase">{acc.account_type}</span>
                  </div>
                  <CardTitle className="text-sm font-bold text-ink mt-1.5">{acc.account_name}</CardTitle>
                  <CardDescription className="text-xs font-mono text-ink-subtle">
                    {acc.account_number ? `A/C: ****${acc.account_number.slice(-4)}` : "A/C: N/A"} {acc.ifsc_code ? `| IFSC: ${acc.ifsc_code}` : ""}
                  </CardDescription>

                </CardHeader>
                <CardContent className="pt-2 border-t border-hairline flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-ink-subtle uppercase font-mono block">Current Balance</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {formatCurrency(acc.current_balance)}
                    </span>
                  </div>
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
              if (!bankName.trim() || !accountNumber.trim()) {
                toast.error("Please enter Bank Name and Account Number.");
                return;
              }
              createBankMutation.mutate({
                account_name: accountName.trim(),
                bank_name: bankName.trim(),
                account_number: accountNumber.trim(),
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
    </div>
  );
}
