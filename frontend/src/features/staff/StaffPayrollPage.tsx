import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Wallet, IndianRupee, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/common/PageHeader";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import staffService, {
  type StaffLedgerEntry,
  type StaffPayrollRow,
} from "./services/staffService";

export default function StaffPayrollPage() {
  const queryClient = useQueryClient();
  const [billingMonth, setBillingMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  // Add Employee form state
  const [showAdd, setShowAdd] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [baseSalary, setBaseSalary] = useState("");
  const [commRate, setCommRate] = useState("0");

  // Ledger Entry form state
  const [entryType, setEntryType] = useState<StaffLedgerEntry["entry_type"]>("ADVANCE");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryRemarks, setEntryRemarks] = useState("");

  const { data: payroll, isLoading } = useQuery({
    queryKey: ["staff-payroll", billingMonth],
    queryFn: () => staffService.previewPayroll(billingMonth),
  });

  const { data: ledger } = useQuery({
    queryKey: ["staff-ledger", selectedUuid],
    queryFn: () => staffService.getLedger(selectedUuid!),
    enabled: Boolean(selectedUuid),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      staffService.createEmployee({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        role,
        base_salary: Number(baseSalary) || 0,
        commission_rate_per_liter: Number(commRate) || 0,
      }),
    onSuccess: () => {
      toast.success("Staff member added");
      setShowAdd(false);
      setFullName("");
      setPhone("");
      setBaseSalary("");
      setCommRate("0");
      queryClient.invalidateQueries({ queryKey: ["staff-payroll"] });
    },
    onError: () => toast.error("Failed to add staff member"),
  });

  const ledgerMutation = useMutation({
    mutationFn: () =>
      staffService.recordLedgerEntry(selectedUuid!, {
        entry_date: getTodayDateString(),
        entry_type: entryType,
        amount: Number(entryAmount),
        remarks: entryRemarks.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Staff ledger updated");
      setEntryAmount("");
      setEntryRemarks("");
      queryClient.invalidateQueries({ queryKey: ["staff-ledger", selectedUuid] });
      queryClient.invalidateQueries({ queryKey: ["staff-payroll"] });
    },
    onError: () => toast.error("Failed to record entry"),
  });

  const payMutation = useMutation({
    mutationFn: (row: StaffPayrollRow) =>
      staffService.paySalary(row.employee_uuid, {
        billing_month: billingMonth,
        payment_mode: "CASH",
        deduct_outstanding: true,
      }),
    onSuccess: (res) => {
      toast.success(
        `Paid ${formatCurrency(res.net_paid)} to ${res.full_name} (deducted ${formatCurrency(res.deducted_amount)})`
      );
      queryClient.invalidateQueries({ queryKey: ["staff-payroll"] });
      if (selectedUuid) {
        queryClient.invalidateQueries({ queryKey: ["staff-ledger", selectedUuid] });
      }
    },
    onError: () => toast.error("Failed to process salary payout"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff, Advances & Payroll"
        description="Manage attendant salaries, commissions, loans/advances, and shift shortages."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" />
              Add Staff
            </button>
          </div>
        }
      />

      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-semibold">New Staff Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input
              placeholder="Full Name *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="OPERATOR">Attendant / Operator</option>
              <option value="MANAGER">Manager</option>
            </select>
            <input
              type="number"
              placeholder="Base Salary (₹)"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Comm ₹/L"
              value={commRate}
              onChange={(e) => setCommRate(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-md border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!fullName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              Save Staff
            </button>
          </div>
        </div>
      )}

      {payroll && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Base Salary</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(payroll.total_base_salary)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Commission</p>
            <p className="text-lg font-bold mt-1 text-emerald-600">{formatCurrency(payroll.total_commission)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Advances / Shortages Deducted</p>
            <p className="text-lg font-bold mt-1 text-amber-600">{formatCurrency(payroll.total_deductions)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Net Payable ({payroll.billing_month})</p>
            <p className="text-lg font-bold mt-1">{formatCurrency(payroll.total_net_payable)}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Staff Name</th>
              <th className="px-4 py-3 text-right">Base Salary</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-right">Advances / Loans</th>
              <th className="px-4 py-3 text-right">Shortages</th>
              <th className="px-4 py-3 text-right">Net Payable</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading staff payroll…
                </td>
              </tr>
            ) : !payroll || payroll.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No active staff profiles yet. Click &ldquo;Add Staff&rdquo; to create one.
                </td>
              </tr>
            ) : (
              payroll.rows.map((row) => (
                <tr key={row.employee_uuid} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">
                    {row.full_name}
                    <span className="ml-2 text-xs text-muted-foreground">({row.role})</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.base_salary)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600">
                    {formatCurrency(row.commission_earned)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatCurrency(row.advances_and_loans)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">
                    {formatCurrency(row.shift_shortages)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    {formatCurrency(row.net_payable)}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUuid(row.employee_uuid)}
                      className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs hover:bg-muted/40"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Ledger
                    </button>
                    <button
                      type="button"
                      disabled={payMutation.isPending}
                      onClick={() => payMutation.mutate(row)}
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pay Salary
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedUuid && ledger && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold">
                {ledger.full_name} — Advances, Loans & Shortages
              </h3>
              <p className="text-xs text-muted-foreground">
                Current Outstanding Balance:{" "}
                <strong className="text-foreground">{formatCurrency(ledger.outstanding_balance)}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUuid(null)}
              className="rounded border px-2.5 py-1 text-xs"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as StaffLedgerEntry["entry_type"])}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ADVANCE">Advance Given</option>
              <option value="LOAN">Personal Loan</option>
              <option value="SHORTAGE">Shift Cash Shortage</option>
              <option value="REPAYMENT">Cash Repayment</option>
              <option value="COMMISSION">Bonus / Commission</option>
            </select>
            <input
              type="number"
              placeholder="Amount (₹)"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              placeholder="Remarks (optional)"
              value={entryRemarks}
              onChange={(e) => setEntryRemarks(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!entryAmount || Number(entryAmount) <= 0 || ledgerMutation.isPending}
              onClick={() => ledgerMutation.mutate()}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <IndianRupee className="h-4 w-4" />
              Record Entry
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto border-t pt-2 space-y-1.5 text-xs">
            {ledger.entries.length === 0 ? (
              <p className="text-muted-foreground">No ledger entries yet.</p>
            ) : (
              ledger.entries.map((entry) => (
                <div key={entry.uuid} className="flex items-center justify-between py-1 border-b border-border/50">
                  <div>
                    <span className="font-semibold">{entry.entry_type}</span>{" "}
                    <span className="text-muted-foreground">· {entry.entry_date}</span>
                    {entry.remarks && <span className="ml-2 text-muted-foreground">— {entry.remarks}</span>}
                  </div>
                  <span className={`font-mono font-semibold ${entry.signed_amount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {entry.signed_amount > 0 ? "+" : ""}{formatCurrency(entry.signed_amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
