import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { getTodayDateString } from "@/lib/utils";
import { Plus, Minus, Fuel, Landmark, Pencil, Trash2, Coins } from "lucide-react";
import inventoryService from "@/features/inventory/services/inventoryService";

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



const DENOMINATIONS = [
  { value: 500, key: "n500" },
  { value: 200, key: "n200" },
  { value: 100, key: "n100" },
  { value: 50, key: "n50" },
  { value: 20, key: "n20" },
  { value: 10, key: "n10" },
] as const;

export default function IncomePage() {
  const { hasRole } = useCurrentUser();
  const canManage = hasRole("ADMIN", "MANAGER");

  const [date, setDate] = useState(getTodayDateString());
  const queryClient = useQueryClient();
  const { data: nozzleData } = useQuery({
    queryKey: ["nozzleReadingsBulkForm", date],
    queryFn: () => inventoryService.getBulkReadingsForm(date),
  });

  // Helper to normalize fuel type strings
  const normalizeFuelType = (ft: string): "DIESEL" | "PETROL" | "SPEED" => {
    if (!ft) return "PETROL";
    const upper = ft.toUpperCase();
    if (upper.includes("DIESEL") || upper.includes("HSD")) return "DIESEL";
    if (upper.includes("SPEED")) return "SPEED";
    return "PETROL";
  };

  const nozzleItems = nozzleData?.items || [];
  const rawSalesByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };
  const nozzleTestingByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };

  nozzleItems.forEach((item: any) => {
    const key = normalizeFuelType(item.fuel_type);
    const openVal = Number(item.opening_reading ?? 0);
    const closeVal = item.closing_reading !== null ? Number(item.closing_reading) : openVal;
    const rawSales = Math.max(0, closeVal - openVal);
    const testing = Number(item.testing ?? 0);
    rawSalesByFuel[key] = (rawSalesByFuel[key] || 0) + rawSales;
    nozzleTestingByFuel[key] = (nozzleTestingByFuel[key] || 0) + testing;
  });

  const getTankStorageTestingFor = (targetKey: "DIESEL" | "PETROL" | "SPEED"): number => {
    try {
      const perTankSaved = localStorage.getItem("per_tank_testing_map");
      if (perTankSaved) {
        const perTankMap: Record<string, number> = JSON.parse(perTankSaved);
        const cachedTanks: any[] = queryClient.getQueryData(["tanks"]) || [];
        if (cachedTanks && cachedTanks.length > 0) {
          let tankSum = 0;
          let foundMatchingTank = false;
          cachedTanks.forEach((tank: any) => {
            if (normalizeFuelType(tank.fuel_type) === targetKey) {
              if (perTankMap[tank.uuid] !== undefined) {
                tankSum += Number(perTankMap[tank.uuid]) || 0;
                foundMatchingTank = true;
              }
            }
          });
          if (foundMatchingTank) return tankSum;
        }
      }
    } catch (e) {}

    try {
      const defaultSaved = localStorage.getItem("default_fuel_testing");
      if (defaultSaved) {
        const defaultMap: Record<string, number> = JSON.parse(defaultSaved);
        for (const [k, v] of Object.entries(defaultMap)) {
          if (normalizeFuelType(k) === targetKey) {
            return Number(v) || 0;
          }
        }
      }
    } catch (e) {}

    return targetKey === "DIESEL" ? 20 : 10;
  };

  const getTestingFor = (targetKey: "DIESEL" | "PETROL" | "SPEED"): number => {
    const nozzleTest = nozzleTestingByFuel[targetKey] || 0;
    const tankTest = getTankStorageTestingFor(targetKey);
    return nozzleTest + tankTest;
  };
  // Which kind the entry dialog is adding (null = closed).
  const [entryKind, setEntryKind] = useState<IncomeKind | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Income | null>(null);

  // Local state for cash denominations per date
  const cacheKey = `ledger_denominations_${date}`;
  const [notes, setNotes] = useState(() => ({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 }));

  useEffect(() => {
    const saved = localStorage.getItem(cacheKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotes(parsed.notes || { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 });
      } catch (e) {
        console.error("Failed to parse denominations", e);
      }
    } else {
      setNotes({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 });
    }
  }, [date, cacheKey]);

  const handleNotesChange = (updatedNotes: typeof notes) => {
    setNotes(updatedNotes);
    const saved = localStorage.getItem(cacheKey);
    let parsed: any = {};
    if (saved) {
      try { parsed = JSON.parse(saved); } catch {}
    }
    localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, notes: updatedNotes }));
  };

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

  // Split the single list into income, expense, and deposit rows.
  const { incomeRows, expenseRows, depositRows } = useMemo(() => {
    const items = incomeData?.items ?? [];
    return {
      incomeRows: items.filter((i) => i.kind === "INCOME"),
      expenseRows: items.filter((i) => i.kind === "EXPENSE"),
      depositRows: items.filter((i) => i.kind === "DEPOSIT"),
    };
  }, [incomeData]);

  async function handleDelete(income: Income) {
    const noun = income.kind === "DEPOSIT" ? "deposit" : income.kind === "EXPENSE" ? "expense" : "income";
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

  const hsdTesting = getTestingFor("DIESEL");
  const msTesting = getTestingFor("PETROL");
  const speedTesting = getTestingFor("SPEED");

  const hsdRaw = rawSalesByFuel["DIESEL"] || 0;
  const msRaw = rawSalesByFuel["PETROL"] || 0;
  const speedRaw = rawSalesByFuel["SPEED"] || 0;

  const hsdNet = Math.max(0, hsdRaw - hsdTesting);
  const msNet = Math.max(0, msRaw - msTesting);
  const speedNet = Math.max(0, speedRaw - speedTesting);

  const getRateFor = (fuelType: "DIESEL" | "PETROL" | "SPEED"): number => {
    const match = summary?.fuel_sales.find(
      (s: any) => normalizeFuelType(s.fuel_type) === fuelType
    );
    return match ? Number(match.rate) : (fuelType === "DIESEL" ? 98.39 : fuelType === "PETROL" ? 113.35 : 123.00);
  };

  const hsdRate = getRateFor("DIESEL");
  const msRate = getRateFor("PETROL");
  const speedRate = getRateFor("SPEED");

  const hsdAmt = hsdNet * hsdRate;
  const msAmt = msNet * msRate;
  const speedAmt = speedNet * speedRate;

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

      {/* Headline totals cards */}
      {summaryError ? (
        <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-medium text-error">
          Unable to load the daily summary.
        </p>
      ) : summaryLoading ? (
        <LoadingState />
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
              Payments Received
            </p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              ₹{formatMoney(summary.total_payments ?? 0)}
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
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Total Deposits
            </p>
            <p className="mt-2 text-2xl font-bold text-ink-muted">
              ₹{formatMoney(summary.total_deposits ?? 0)}
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

      {/* Cash Denomination Calculator Card */}
      <CashDenominationsCard notes={notes} onChange={handleNotesChange} />

      {/* Fuel sales by type */}
      {summary && (
        <div className="rounded-2xl border border-hairline bg-card overflow-hidden">
          <div className="border-b border-hairline px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Fuel Sales by Type</h3>
            <span className="text-xs font-mono font-bold text-fuel-amber bg-fuel-amber/10 px-3 py-1.5 rounded-xl">
              Total Sales: ₹{formatMoney(hsdAmt + msAmt + speedAmt)}
            </span>
          </div>
          <div className="p-5 space-y-4 bg-surface-2/40 font-mono">
            {[
              { label: "H.S.D", raw: hsdRaw, testing: hsdTesting, net: hsdNet, rate: hsdRate, amt: hsdAmt },
              { label: "M.S", raw: msRaw, testing: msTesting, net: msNet, rate: msRate, amt: msAmt },
              { label: "Speed", raw: speedRaw, testing: speedTesting, net: speedNet, rate: speedRate, amt: speedAmt },
            ].map(({ label, raw, testing, net, rate, amt }) => (
              <div
                key={label}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline/45 pb-3 last:border-none last:pb-0 text-xs sm:text-sm text-ink-muted"
              >
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                  <span className="font-bold text-ink w-16 text-left">{label}</span>
                  <span>= {raw.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}</span>
                  <span className="text-error font-medium">- {testing.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                  <span className="font-bold text-ink">= {net.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} L</span>
                  <span className="text-fuel-amber font-bold">× {rate.toFixed(2)}</span>
                </div>
                <span className="font-bold text-neutral-800 text-right min-w-[100px]">
                  ₹{formatMoney(amt)}
                </span>
              </div>
            ))}
          </div>
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
          onEdit={setIncomeToEdit}
        />
        <EntryList
          title="Expenses"
          rows={expenseRows}
          emptyText="No expenses recorded for this date."
          isError={listError}
          isLoading={listLoading}
          canManage={canManage}
          onDelete={handleDelete}
          onEdit={setIncomeToEdit}
          showCustomer
        />
      </div>

      {/* Deposits Section */}
      <EntryList
        title="Deposits to Bank"
        rows={depositRows}
        emptyText="No bank deposits recorded for this date."
        isError={listError}
        isLoading={listLoading}
        canManage={canManage}
        onDelete={handleDelete}
        onEdit={setIncomeToEdit}
      />

      <AddEntryDialog
        kind={incomeToEdit ? incomeToEdit.kind : (entryKind ?? "INCOME")}
        open={entryKind !== null || incomeToEdit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEntryKind(null);
            setIncomeToEdit(null);
          }
        }}
        defaultDate={date}
        incomeToEdit={incomeToEdit ?? undefined}
      />
      <AddEntryDialog
        kind="DEPOSIT"
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
  onEdit?(income: Income): void;
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
  onEdit,
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
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
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => onEdit?.(row)}
                          className="text-ink-muted hover:text-fuel-amber transition duration-200 cursor-pointer"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => onDelete(row)}
                          className="text-ink-muted hover:text-error transition duration-200 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CashDenominationsCard({
  notes,
  onChange,
}: {
  notes: { n500: number; n200: number; n100: number; n50: number; n20: number; n10: number };
  onChange: (updatedNotes: { n500: number; n200: number; n100: number; n50: number; n20: number; n10: number }) => void;
}) {
  const totalCashCounted = DENOMINATIONS.reduce(
    (sum, d) => sum + (notes[d.key] || 0) * d.value,
    0
  );

  return (
    <div className="rounded-2xl border border-hairline bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Coins className="text-fuel-amber" size={18} />
          <h3 className="text-sm font-semibold text-ink">Cash Denomination Calculator</h3>
        </div>
        <span className="text-xs font-mono font-bold text-fuel-amber bg-fuel-amber/10 px-3 py-1.5 rounded-xl">
          Total Cash Counted: ₹{totalCashCounted.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {DENOMINATIONS.map(({ value, key }) => {
          const count = notes[key] || 0;
          const subtotal = count * value;
          return (
            <div
              key={key}
              className="rounded-xl border border-hairline bg-surface-2 p-3 space-y-2 text-center"
            >
              <div className="text-xs font-bold text-ink-muted">₹{value} Notes</div>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs text-ink-muted">×</span>
                <input
                  type="number"
                  min="0"
                  value={count || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    onChange({ ...notes, [key]: val });
                  }}
                  className="w-16 rounded-lg border border-hairline bg-card px-2 py-1 text-center font-bold text-sm text-ink outline-none focus:border-fuel-amber"
                />
              </div>
              <div className="text-xs font-mono font-semibold text-ink">
                ₹{subtotal.toLocaleString("en-IN")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
