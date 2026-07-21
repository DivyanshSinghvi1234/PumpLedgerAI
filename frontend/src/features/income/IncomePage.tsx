import { useMemo, useState } from "react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { getTodayDateString } from "@/lib/utils";
import { Plus, Minus, Fuel, Landmark } from "lucide-react";

import AddEntryDialog from "./components/AddEntryDialog";
import NoBillSaleDialog from "./components/NoBillSaleDialog";

import { useIncomeSummary } from "./hooks/useIncomeSummary";
import { useIncomeList } from "./hooks/useIncomeList";
import { useDeleteIncome } from "./hooks/useDeleteIncome";
import type { Income, IncomeKind } from "./types/income";

function formatMoney(value: number): string {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const FUEL_LABELS: Record<string, string> = {
  PETROL: "Petrol",
  SPEED: "Speed",
  DIESEL: "Diesel",
  LUBRICANT: "Lubricant",
};

export default function IncomePage() {
  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [date, setDate] = useState(getTodayDateString());
  // Which kind the entry dialog is adding (null = closed).
  const [entryKind, setEntryKind] = useState<IncomeKind | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  // Bank deposit is just a cash expense with a fixed label; own dialog so it
  // opens prefilled without disturbing the plain Add Expense flow.
  const [depositOpen, setDepositOpen] = useState(false);

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useIncomeSummary(date);

  const {
    data: incomeData,
    isLoading: listLoading,
    isError: listError,
  } = useIncomeList({ income_date: date, page: 1, page_size: 100 });

  const deleteMutation = useDeleteIncome();

  // Split the single list into income and expense rows.
  const { incomeRows, expenseRows } = useMemo(() => {
    const items = incomeData?.items ?? [];
    return {
      incomeRows: items.filter((i) => i.kind === "INCOME"),
      expenseRows: items.filter((i) => i.kind === "EXPENSE"),
    };
  }, [incomeData]);

  async function handleDelete(income: Income) {
    const noun = income.kind === "EXPENSE" ? "expense" : "income";
    const loanNote = income.customer_name
      ? ` This will remove ₹${formatMoney(income.amount)} from ${income.customer_name}'s outstanding balance.`
      : "";
    if (
      !window.confirm(
        `Delete ${noun} "${income.description}" of ₹${formatMoney(income.amount)}?${loanNote}`
      )
    ) {
      return;
    }
    await deleteMutation.mutateAsync(income.uuid);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Income / Expenses"
        description="Daily sales by fuel type, plus incomes, expenses, and cash in hand."
      />

      {/* Date picker + actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm text-ink outline-none focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20"
          />
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSaleOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-3 transition cursor-pointer"
            >
              <Fuel size={16} /> Record Sale (no bill)
            </button>
            <button
              onClick={() => setDepositOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-3 transition cursor-pointer"
            >
              <Landmark size={16} /> Deposit to Bank
            </button>
            <button
              onClick={() => setEntryKind("EXPENSE")}
              className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-3 transition cursor-pointer"
            >
              <Minus size={16} /> Add Expense
            </button>
            <button
              onClick={() => setEntryKind("INCOME")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuel-amber to-fuel-orange text-canvas px-4 py-2.5 text-sm font-bold shadow-lg shadow-fuel-amber/25 hover:from-fuel-gold hover:to-fuel-amber transition-all cursor-pointer"
            >
              <Plus size={16} /> Add Income
            </button>
          </div>
        )}
      </div>

      {/* Four headline totals */}
      {summaryError ? (
        <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-medium text-error">
          Unable to load the daily summary.
        </p>
      ) : summaryLoading ? (
        <LoadingState />
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Total Sales
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              ₹{formatMoney(summary.total_sales)}
            </p>
          </div>
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Total Incomes
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              ₹{formatMoney(summary.total_incomes)}
            </p>
          </div>
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Total Expenses
            </p>
            <p className="mt-2 text-2xl font-bold text-error">
              ₹{formatMoney(summary.total_expenses)}
            </p>
          </div>
          <div className="rounded-2xl border border-fuel-amber/30 bg-fuel-amber/5 p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Cash in Hand
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">
              ₹{formatMoney(summary.cash_in_hand)}
            </p>
          </div>
        </div>
      ) : null}

      {/* Fuel sales by type */}
      {summary && summary.fuel_sales.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-card overflow-hidden">
          <div className="border-b border-hairline px-5 py-3">
            <h3 className="text-sm font-semibold text-ink">Fuel Sales by Type</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="px-5 py-2.5 font-medium">Fuel</th>
                <th className="px-5 py-2.5 font-medium text-right">Qty (L)</th>
                <th className="px-5 py-2.5 font-medium text-right">Rate</th>
                <th className="px-5 py-2.5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.fuel_sales.map((row) => (
                <tr
                  key={row.fuel_type}
                  className="border-t border-hairline text-ink"
                >
                  <td className="px-5 py-2.5">
                    {FUEL_LABELS[row.fuel_type] ?? row.fuel_type}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {Number(row.liters).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    ₹{formatMoney(row.rate)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold">
                    ₹{formatMoney(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-hairline bg-surface-2/50 font-bold text-ink">
                <td className="px-5 py-2.5" colSpan={3}>
                  Total Sales
                </td>
                <td className="px-5 py-2.5 text-right">
                  ₹{formatMoney(summary.total_sales)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Income + Expense sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EntryList
          title="Incomes / Variables"
          rows={incomeRows}
          emptyText="No incomes recorded for this date."
          isError={listError}
          isLoading={listLoading}
          canManage={canManage}
          onDelete={handleDelete}
        />
        <EntryList
          title="Expenses"
          rows={expenseRows}
          emptyText="No expenses recorded for this date."
          isError={listError}
          isLoading={listLoading}
          canManage={canManage}
          onDelete={handleDelete}
          showCustomer
        />
      </div>

      <AddEntryDialog
        kind={entryKind ?? "INCOME"}
        open={entryKind !== null}
        onOpenChange={(open) => setEntryKind(open ? entryKind : null)}
        defaultDate={date}
      />
      {/* Bank deposit is just a cash-out expense with a fixed label — reuses
          the entry dialog so no separate form/endpoint is needed. */}
      <AddEntryDialog
        kind="EXPENSE"
        open={depositOpen}
        onOpenChange={setDepositOpen}
        defaultDate={date}
        preset={{
          title: "Deposit Cash to Bank",
          description: "Cash deposited to bank",
          category: "Bank Deposit",
        }}
      />
      <NoBillSaleDialog
        open={saleOpen}
        onOpenChange={setSaleOpen}
        defaultDate={date}
      />
    </div>
  );
}

interface EntryListProps {
  title: string;
  rows: Income[];
  emptyText: string;
  isError: boolean;
  isLoading: boolean;
  canManage: boolean;
  onDelete(income: Income): void;
  /** Show a "To" column with the linked customer (for loans). */
  showCustomer?: boolean;
}

function EntryList({
  title,
  rows,
  emptyText,
  isError,
  isLoading,
  canManage,
  onDelete,
  showCustomer = false,
}: EntryListProps) {
  return (
    <div className="rounded-2xl border border-hairline bg-card overflow-hidden">
      <div className="border-b border-hairline px-5 py-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>

      {isError ? (
        <p className="px-5 py-6 text-sm font-medium text-error">
          Unable to load rows.
        </p>
      ) : isLoading ? (
        <div className="px-5 py-6">
          <LoadingState />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="px-5 py-2.5 font-medium">Description</th>
              {showCustomer && (
                <th className="px-5 py-2.5 font-medium">To (loan)</th>
              )}
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-5 py-2.5 font-medium">Mode</th>
              <th className="px-5 py-2.5 font-medium text-right">Amount</th>
              {canManage && <th className="px-5 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.uuid} className="border-t border-hairline text-ink">
                <td className="px-5 py-2.5">{row.description}</td>
                {showCustomer && (
                  <td className="px-5 py-2.5 text-ink-muted">
                    {row.customer_name ?? "—"}
                  </td>
                )}
                <td className="px-5 py-2.5 text-ink-muted">
                  {row.category ?? "—"}
                </td>
                <td className="px-5 py-2.5 text-ink-muted">
                  {row.payment_mode}
                </td>
                <td className="px-5 py-2.5 text-right font-semibold">
                  ₹{formatMoney(row.amount)}
                </td>
                {canManage && (
                  <td className="px-5 py-2.5 text-right">
                    <button
                      onClick={() => onDelete(row)}
                      className="text-xs font-medium text-error hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
