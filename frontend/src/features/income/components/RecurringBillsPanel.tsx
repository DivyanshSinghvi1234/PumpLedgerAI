import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import BankAccountSelect from "@/components/common/BankAccountSelect";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import recurringExpenseService from "../services/recurringExpenseService";

interface RecurringBillsPanelProps {
  canManage: boolean;
}

export default function RecurringBillsPanel({ canManage }: RecurringBillsPanelProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<"MONTHLY" | "WEEKLY" | "DAILY">("MONTHLY");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "BANK" | "UPI">("BANK");
  const [bankAccountUuid, setBankAccountUuid] = useState("");
  const [nextDueDate, setNextDueDate] = useState(getTodayDateString());

  const { data: dueBills = [] } = useQuery({
    queryKey: ["recurring-expenses-due"],
    queryFn: () => recurringExpenseService.listDue(),
    enabled: canManage,
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["recurring-expenses-all"],
    queryFn: () => recurringExpenseService.listAll(),
    enabled: canManage && expanded,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["recurring-expenses-due"] });
    queryClient.invalidateQueries({ queryKey: ["recurring-expenses-all"] });
    queryClient.invalidateQueries({ queryKey: ["incomes"] });
    queryClient.invalidateQueries({ queryKey: ["incomeSummary"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
  };

  const postAllMutation = useMutation({
    mutationFn: () => recurringExpenseService.postAllDue(),
    onSuccess: (res) => {
      toast.success(`Posted ${res.posted_count} due bill(s) (${formatCurrency(res.total_amount)})`);
      invalidateAll();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to post due bills"),
  });

  const postOneMutation = useMutation({
    mutationFn: (uuid: string) => recurringExpenseService.postOne(uuid),
    onSuccess: (res: any) => {
      toast.success(`Posted ${res.title} (${formatCurrency(res.posted_amount)})`);
      invalidateAll();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to post bill"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      recurringExpenseService.create({
        title: title.trim(),
        category: category.trim() || "Utilities",
        amount: Number(amount),
        frequency,
        payment_mode: paymentMode,
        bank_account_uuid: paymentMode !== "CASH" && bankAccountUuid ? bankAccountUuid : null,
        next_due_date: nextDueDate,
      }),
    onSuccess: () => {
      toast.success("Recurring bill scheduled");
      setTitle("");
      setAmount("");
      invalidateAll();
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to save recurring bill"),
  });

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => recurringExpenseService.remove(uuid),
    onSuccess: () => {
      toast.success("Recurring bill removed");
      invalidateAll();
    },
  });

  if (!canManage) return null;

  const dueTotal = dueBills.reduce((s, b) => s + Number(b.amount || 0), 0);

  return (
    <div className="rounded-2xl border border-hairline bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarClock className="h-5 w-5 text-fuel-amber" />
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Recurring Bills & Fixed Expenses
              {dueBills.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-500">
                  {dueBills.length} due ({formatCurrency(dueTotal)})
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-muted">
              Schedule rent, electricity, internet, or EMIs and post them in one click.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {dueBills.length > 0 && (
            <button
              type="button"
              disabled={postAllMutation.isPending}
              onClick={() => postAllMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {postAllMutation.isPending ? "Posting..." : `Approve & Post All Due (${formatCurrency(dueTotal)})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-2/80 cursor-pointer"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide Schedule" : "Manage Schedule"}
          </button>
        </div>
      </div>

      {dueBills.length > 0 && !expanded && (
        <div className="flex flex-wrap gap-2 pt-1">
          {dueBills.map((bill) => (
            <div
              key={bill.uuid}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs"
            >
              <span className="font-medium text-ink">{bill.title}</span>
              <span className="font-mono font-bold text-amber-500">{formatCurrency(bill.amount)}</span>
              <button
                type="button"
                disabled={postOneMutation.isPending}
                onClick={() => postOneMutation.mutate(bill.uuid)}
                className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                Post
              </button>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="border-t border-hairline pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Bill Title *</label>
              <input
                placeholder="e.g. Electricity Bill, Pump Rent"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
                <option value="DAILY">Daily</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Next Due Date</label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-ink-muted mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full rounded-md border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink"
              >
                <option value="BANK">Bank Transfer / Auto-Debit</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash Drawer</option>
              </select>
            </div>
            {paymentMode !== "CASH" ? (
              <BankAccountSelect
                value={bankAccountUuid}
                onChange={setBankAccountUuid}
                label="Bank Account (Optional)"
              />
            ) : (
              <div />
            )}
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!title.trim() || !amount || Number(amount) <= 0 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-fuel-amber px-4 py-2 text-xs font-semibold text-canvas hover:bg-fuel-amber/90 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Recurring Bill
              </button>
            </div>
          </div>

          {allBills.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-hairline">
              <table className="min-w-full text-xs">
                <thead className="bg-surface-2 text-ink-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Title</th>
                    <th className="px-3 py-2 text-left">Frequency</th>
                    <th className="px-3 py-2 text-left">Mode</th>
                    <th className="px-3 py-2 text-left">Next Due</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allBills.map((b) => (
                    <tr key={b.uuid} className="border-t border-hairline">
                      <td className="px-3 py-2 font-medium text-ink">
                        {b.title}
                        <span className="ml-2 text-[11px] text-ink-muted">({b.category})</span>
                      </td>
                      <td className="px-3 py-2 text-ink-muted">{b.frequency}</td>
                      <td className="px-3 py-2 text-ink-muted">{b.payment_mode}</td>
                      <td className="px-3 py-2 font-mono">{b.next_due_date}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(b.amount)}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => postOneMutation.mutate(b.uuid)}
                          className="text-emerald-500 font-semibold hover:underline cursor-pointer"
                        >
                          Post Now
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(b.uuid)}
                          className="text-ink-muted hover:text-error cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="inline h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
