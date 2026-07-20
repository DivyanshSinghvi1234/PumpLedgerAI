import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import voucherService from "@/features/vouchers/services/voucherService";
import type { FuelType } from "@/features/inventory/types";
import type {
  DailySheetPaymentModeAmounts,
  DailySheetExpense,
  ExpenseType,
  ExpensePaymentMode,
} from "../services/dailySheetService";

/* Fixed starter list. ponytail: hardcoded categories; upgrade path is a small
   expense_categories settings table if user-defined categories are needed. */
const EXPENSE_CATEGORIES = [
  "Fuel purchase",
  "Salary",
  "Tea / snacks",
  "Owner drawing",
  "Repair / maintenance",
  "Electricity",
  "Other",
];

// ₹2000 note intentionally excluded (demonetised from circulation).
const DENOMINATION_NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];

/* ─────────────────────────────────────────────────────────────── helpers ── */
function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRs(n: number): string {
  return `₹${fmt(n)}`;
}

function fmtDt(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  PETROL: "Petrol (MS)",
  DIESEL: "HSD (Diesel)",
  POWER_PETROL: "Power Petrol",
  POWER_DIESEL: "Power Diesel",
  CNG: "CNG",
};

/* ─────────────────────────────────────────────────────────────── types ──── */
interface SheetPreviewProps {
  createDate: string;
  periodStart: string;
  periodEnd: string;
  sheetAlreadyExists: boolean;
  onGenerate: (
    manualPaymentModeAmounts: DailySheetPaymentModeAmounts,
    expenses: DailySheetExpense[],
  ) => void;
  isGenerating: boolean;
  createError: string | null;
}

/* ═══════════════════════════════════════════════════════════════ component ═ */
export default function SheetPreview({
  createDate,
  periodStart,
  periodEnd,
  sheetAlreadyExists,
  onGenerate,
  isGenerating,
  createError: _createError,
}: SheetPreviewProps) {
  // Manual per-mode amounts were replaced by Income/Expense rows (an "income"
  // entry adds un-vouchered sales to a payment mode). Kept as a zero constant so
  // the create payload shape and backend stay unchanged.
  // ponytail: dead zero payload; upgrade path is dropping the field from the
  // create schema + onGenerate signature if no sheet ever needs it again.
  const manualPaymentAmounts: DailySheetPaymentModeAmounts = { cash: 0, upi: 0, card: 0, credit: 0 };

  // Expense / income rows entered in the preview, persisted on Generate & Save.
  const [expenses, setExpenses] = useState<DailySheetExpense[]>([]);
  const [newExpense, setNewExpense] = useState<{
    category: string; description: string; amount: string;
    type: ExpenseType; payment_mode: ExpensePaymentMode;
  }>({ category: EXPENSE_CATEGORIES[0], description: "", amount: "", type: "expense", payment_mode: "cash" });

  const addExpense = () => {
    const amt = parseFloat(newExpense.amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setExpenses((prev) => [...prev, {
      category: newExpense.category,
      description: newExpense.description || newExpense.category,
      amount: amt,
      type: newExpense.type,
      payment_mode: newExpense.payment_mode,
    }]);
    setNewExpense((p) => ({ ...p, description: "", amount: "" }));
  };
  const removeExpense = (idx: number) => setExpenses((prev) => prev.filter((_, i) => i !== idx));
  const updateExpense = (idx: number, patch: Partial<DailySheetExpense>) =>
    setExpenses((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  // Denomination cash cross-check. Display-only, not persisted (matches the
  // saved-sheet view). ₹2000 note excluded.
  const [denomCounts, setDenomCounts] = useState<Record<number, string>>({});
  const denominationTotal = DENOMINATION_NOTES.reduce(
    (s, note) => s + note * (parseInt(denomCounts[note] || "0", 10) || 0),
    0,
  );

  /* ── queries ───────────────────────────────────────────────────────────── */
  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["previewReadings", createDate],
    queryFn: () => inventoryService.getBulkReadingsForm(createDate),
  });

  // Match the saved sheet, which sums vouchers by invoice_date (see
  // daily_sheet_service). Filtering the preview by the created_at window
  // instead made a voucher back-dated to 19 Jul but saved on 20 Jul show in
  // the wrong day's preview. from_date/to_date filter on invoice_date.
  const voucherParams = {
    from_date: createDate,
    to_date: createDate,
    page_size: 200,
  };

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["previewPayments", createDate],
    queryFn: () =>
      paymentService.getPayments({ payment_date: createDate, page_size: 200 }),
  });

  const { data: dailyVouchers, isLoading: vouchersLoading } = useQuery({
    queryKey: ["previewVouchers", createDate, voucherParams],
    queryFn: () => voucherService.getVouchers(voucherParams),
  });

  // Shifts run 6:00 AM to 6:00 AM — look up active rates at 6:00 AM for today and yesterday.
  const { data: ratesMap } = useQuery({
    queryKey: ["previewRatesMap", createDate],
    queryFn: async () => {
      const fuelTypes: FuelType[] = ["PETROL", "SPEED", "DIESEL", "LUBRICANT"];
      
      // Calculate yesterday's date string safely
      const [y, m, d] = createDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      const yesterdayStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

      const todayMap: Record<string, number> = { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };
      const yesterdayMap: Record<string, number> = { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };

      const rateTimeToday = new Date(`${createDate}T06:00:00`).toISOString();
      const rateTimeYesterday = new Date(`${yesterdayStr}T06:00:00`).toISOString();

      await Promise.all(
        fuelTypes.map(async (ft) => {
          // Today's rate (post 6 AM)
          try {
            const res = await inventoryService.getActiveRate(ft, rateTimeToday);
            todayMap[ft] = Number(res.rate);
          } catch {
            todayMap[ft] = 0;
          }
          // Yesterday's rate (pre 6 AM)
          try {
            const res = await inventoryService.getActiveRate(ft, rateTimeYesterday);
            yesterdayMap[ft] = Number(res.rate);
          } catch {
            yesterdayMap[ft] = 0;
          }
        })
      );
      return { today: todayMap, yesterday: yesterdayMap };
    },
  });

  /* ── nozzle groups with split calculation support ──────────────────────── */
  const nozzleGroups = useMemo(() => {
    const grouped: Record<
      string,
      {
        nozzle_uuid: string;
        nozzle_name: string;
        fuel_type: string;
        opening_reading: number;
        closing_reading: number | null;
        interim_6am_reading: number | null;
        sold: number;
        rate: number;
        amount: number;
        isSplit: boolean;
        soldBefore: number;
        soldAfter: number;
        rateBefore: number;
        rateAfter: number;
      }[]
    > = {};

    const todayRates = ratesMap?.today || { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };
    const yesterdayRates = ratesMap?.yesterday || { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };

    salesForm?.items?.forEach((item) => {
      const ft = item.fuel_type;
      if (!grouped[ft]) grouped[ft] = [];
      const opening = item.opening_reading || 0;
      const closing = item.closing_reading !== null ? item.closing_reading : null;
      const interim = item.interim_6am_reading !== null ? item.interim_6am_reading : null;

      const sold = closing !== null && closing >= opening ? closing - opening : 0;
      
      let amount = 0;
      let rate = todayRates[ft] || 0;
      let isSplit = false;
      let soldBefore = 0;
      let soldAfter = 0;
      let rateBefore = yesterdayRates[ft] || 0;
      let rateAfter = todayRates[ft] || 0;

      if (interim !== null && closing !== null) {
        isSplit = true;
        soldBefore = Math.max(0, interim - opening);
        soldAfter = Math.max(0, closing - interim);

        // Fallbacks if one rate is missing
        if (!rateBefore && rateAfter) rateBefore = rateAfter;
        if (!rateAfter && rateBefore) rateAfter = rateBefore;

        amount = (soldBefore * rateBefore) + (soldAfter * rateAfter);
      } else {
        amount = sold * rate;
      }

      grouped[ft].push({
        nozzle_uuid: item.nozzle_uuid,
        nozzle_name: item.nozzle_name,
        fuel_type: ft,
        opening_reading: opening,
        closing_reading: closing,
        interim_6am_reading: interim,
        sold,
        rate,
        amount,
        isSplit,
        soldBefore,
        soldAfter,
        rateBefore,
        rateAfter,
      });
    });
    return grouped;
  }, [salesForm, ratesMap]);

  const nozzleGroupTotals = useMemo(
    () =>
      Object.entries(nozzleGroups).map(([ft, rows]) => ({
        fuel_type: ft,
        totalSold: rows.reduce((s, r) => s + r.sold, 0),
        totalAmount: rows.reduce((s, r) => s + r.amount, 0),
      })),
    [nozzleGroups]
  );

  const grandTotalNozzleAmount = useMemo(
    () => nozzleGroupTotals.reduce((s, g) => s + g.totalAmount, 0),
    [nozzleGroupTotals]
  );

  const grandTotalSold = useMemo(
    () => nozzleGroupTotals.reduce((s, g) => s + g.totalSold, 0),
    [nozzleGroupTotals]
  );

  /* ── financial summary ─────────────────────────────────────────────────── */
  const grossFuelSales = useMemo(
    () =>
      grandTotalNozzleAmount > 0
        ? grandTotalNozzleAmount
        : (dailyVouchers?.items?.reduce((s, v) => s + Number(v.total_amount), 0) ?? 0),
    [grandTotalNozzleAmount, dailyVouchers]
  );

  const voucherCreditSales = useMemo(
    () =>
      dailyVouchers?.items
        ?.filter((v) => v.payment_mode === "CREDIT")
        .reduce((s, v) => s + Number(v.total_amount), 0) ?? 0,
    [dailyVouchers]
  );

  const voucherUpiSales = useMemo(
    () => dailyVouchers?.items?.filter((v) => v.payment_mode === "UPI").reduce((s, v) => s + Number(v.total_amount), 0) ?? 0,
    [dailyVouchers]
  );

  const voucherCardSales = useMemo(
    () =>
      dailyVouchers?.items
        ?.filter((v) => v.payment_mode === "CARD")
        .reduce((s, v) => s + Number(v.total_amount), 0) ?? 0,
    [dailyVouchers]
  );

  const voucherCashSales = useMemo(
    () => dailyVouchers?.items?.filter((v) => v.payment_mode === "CASH").reduce((s, v) => s + Number(v.total_amount), 0) ?? 0,
    [dailyVouchers]
  );

  // Per-mode net of the income/expense rows: income adds, expense subtracts.
  // Mirrors the backend + SheetDetail so the "By Payment Mode" and Cash In (A)
  // figures update live as rows are added. Legacy rows default to cash/expense.
  const expenseNetByMode = useMemo(() => {
    const m = { cash: 0, upi: 0, card: 0, credit: 0 };
    for (const e of expenses) {
      const key = (e.payment_mode ?? "cash") as ExpensePaymentMode;
      if (!(key in m)) continue;
      const amt = Number(e.amount || 0);
      m[key] += (e.type ?? "expense") === "income" ? amt : -amt;
    }
    return m;
  }, [expenses]);

  const creditSales = voucherCreditSales + expenseNetByMode.credit;
  const upiSales = voucherUpiSales + expenseNetByMode.upi;
  const cardSales = voucherCardSales + expenseNetByMode.card;
  const digitalSales = upiSales + cardSales;
  const recordedCashSales = voucherCashSales + expenseNetByMode.cash;
  // Per the sheet rule, only CASH-mode income/expense moves the physical drawer;
  // credit/digital are money never in cash, so they're deducted at voucher value.
  const cashSales = grossFuelSales - voucherCreditSales - (voucherUpiSales + voucherCardSales) + expenseNetByMode.cash;

  const totalPaymentsReceived = useMemo(
    () =>
      dailyPayments?.items?.reduce((s, p) => s + Number(p.amount), 0) ?? 0,
    [dailyPayments]
  );

  const fuelTypeKeys = Object.keys(nozzleGroups);
  const isLoading = salesFormLoading || paymentsLoading || vouchersLoading;

  const hasData =
    fuelTypeKeys.length > 0 ||
    (dailyVouchers?.items?.length ?? 0) > 0 ||
    (dailyPayments?.items?.length ?? 0) > 0;

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="pt-4 border-t border-hairline space-y-4">
      {/* ── Generate Banner ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-fuel-amber">
            Live Sheet Preview
          </p>
          <p className="text-xs text-ink-subtle mt-0.5">
            Real-time snapshot for the selected accounting timeline below.
          </p>
        </div>

        {sheetAlreadyExists ? (
          <div className="flex items-center gap-2 text-xs text-fuel-amber font-semibold bg-fuel-amber/5 border border-fuel-amber/10 px-3.5 py-2 rounded-lg">
            <AlertTriangle size={14} />
            Sheet already exists for this date. Open it in{" "}
            <strong>Last Sheet</strong>.
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => onGenerate(manualPaymentAmounts, expenses)}
            disabled={isGenerating || isLoading}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 gap-1.5 cursor-pointer shadow-md shadow-fuel-amber/15"
          >
            <Zap size={13} />
            {isGenerating ? "Generating…" : "Generate & Save Daily Sheet"}
          </Button>
        )}
      </div>

      {/* ── DSR Preview Card ─────────────────────────────────────────────── */}
      <div
        className="border border-hairline rounded-xl bg-surface-1 overflow-hidden"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* Report Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-hairline bg-surface-2">
          <div>
            <p className="text-[11px] font-bold text-ink-subtle">
              Date :{" "}
              <span className="text-ink italic">
                {new Date(createDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </p>
            <p className="text-[10px] text-ink-subtle mt-0.5 font-sans">
              {fmtDt(periodStart)} → {fmtDt(periodEnd)}
            </p>
          </div>
          <div className="text-center">
            <h2 className="text-base font-black text-ink tracking-tight">
              Daily Summary Report
            </h2>
            <p className="text-[9px] text-ink-subtle font-sans">
              Preview — not yet saved
            </p>
          </div>
          <div className="text-right">
            <Badge className="text-[8px] uppercase font-mono font-bold bg-blue-500/15 text-blue-500 hover:bg-blue-500/15 border-transparent">
              Preview
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-ink-subtle">
            Compiling live preview…
          </div>
        ) : (
          <>
            {/* ── Nozzle Meter Readings ──────────────────────────────────── */}
            {fuelTypeKeys.length > 0 ? (
              fuelTypeKeys.map((ft) => {
                const rows = nozzleGroups[ft];
                const totals = nozzleGroupTotals.find(
                  (g) => g.fuel_type === ft
                )!;
                return (
                  <div key={ft}>
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="border-y border-hairline bg-surface-2">
                          <th className="text-left px-3 py-1.5 font-bold text-ink w-[28%]">
                            Nozzle Name
                          </th>
                          <th className="text-right px-3 py-1.5 font-bold text-ink">
                            Op. Reading
                          </th>
                          <th className="text-right px-3 py-1.5 font-bold text-ink">
                            Cl. Reading
                          </th>
                          <th className="text-right px-3 py-1.5 font-bold text-ink">
                            Testing
                          </th>
                          <th className="text-right px-3 py-1.5 font-bold text-ink">
                            Sold
                          </th>
                          <th className="text-right px-3 py-1.5 font-bold text-ink">
                            Rate
                          </th>
                          <th className="text-right px-3 py-1.5 font-bold text-ink">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={row.nozzle_uuid}
                            className="border-b border-hairline hover:bg-surface-2/50"
                          >
                            <td className="px-3 py-1.5 font-semibold text-ink">
                              {row.nozzle_name}
                              <span className="ml-1.5 text-[9px] text-ink-subtle font-normal">
                                ({FUEL_TYPE_LABELS[ft] ?? ft})
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink">
                              {fmt(row.opening_reading, 3)}
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink">
                              {row.closing_reading !== null ? (
                                <div>
                                  <div>{fmt(row.closing_reading, 3)}</div>
                                  {row.isSplit && row.interim_6am_reading !== null && (
                                    <div className="text-[9px] text-fuel-amber font-mono font-normal">
                                      6AM: {fmt(row.interim_6am_reading, 3)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-ink-subtle">—</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink-subtle">
                              0.0
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink font-semibold">
                              {row.closing_reading !== null ? (
                                <div>
                                  <div>{fmt(row.sold, 2)}</div>
                                  {row.isSplit && (
                                    <div className="text-[9px] text-ink-subtle font-normal font-sans">
                                      {fmt(row.soldBefore, 1)} + {fmt(row.soldAfter, 1)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-ink-subtle italic text-[9px]">No reading</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink-subtle">
                              {row.isSplit ? (
                                <div>
                                  <div className="text-ink font-semibold">{fmt(row.rateAfter, 2)}</div>
                                  <div className="text-[9px] text-ink-subtle">Prev: {fmt(row.rateBefore, 2)}</div>
                                </div>
                              ) : (
                                row.rate > 0 ? fmt(row.rate, 2) : "—"
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink font-bold">
                              {row.amount > 0 ? (
                                <div>
                                  <div>{fmt(row.amount, 2)}</div>
                                  {row.isSplit && (
                                    <div className="text-[9px] text-ink-subtle font-normal font-sans">
                                      {fmt(row.soldBefore * row.rateBefore, 0)} + {fmt(row.soldAfter * row.rateAfter, 0)}
                                    </div>
                                  )}
                                </div>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                        {/* Group total */}
                        <tr className="border-y border-hairline bg-surface-3/30 font-bold">
                          <td
                            colSpan={3}
                            className="px-3 py-1.5 text-center text-ink"
                          >
                            Total — {FUEL_TYPE_LABELS[ft] ?? ft}
                          </td>
                          <td className="px-3 py-1.5 text-right text-ink-subtle">
                            0.0
                          </td>
                          <td className="px-3 py-1.5 text-right text-ink">
                            {fmt(totals.totalSold, 2)}
                          </td>
                          <td />
                          <td className="px-3 py-1.5 text-right text-fuel-amber">
                            {fmt(totals.totalAmount, 2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-5 text-center text-xs text-ink-subtle italic border-b border-hairline flex items-center justify-center gap-2">
                <CheckCircle2 size={13} className="text-ink-subtle" />
                No nozzle meter readings found for this date. Add readings in
                Inventory → Meter Readings.
              </div>
            )}

            {/* Grand total bar */}
            {fuelTypeKeys.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-fuel-amber/10 border-y-2 border-fuel-amber/30">
                <div className="flex items-center gap-4 text-[11px] text-ink-subtle">
                  <span>
                    Total Volume:{" "}
                    <strong className="text-ink">{fmt(grandTotalSold, 2)} L</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-ink-subtle uppercase font-bold tracking-wider">
                    Grand Total Nozzle Sales
                  </span>
                  <span className="text-sm font-black text-fuel-amber font-mono">
                    {fmtRs(grandTotalNozzleAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* ── Cash Flow Summary (2-column) ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 border-t border-hairline divide-y lg:divide-y-0 lg:divide-x divide-hairline">
              {/* Left: Invoices breakdown */}
              <div>
                <div className="px-3 py-2 bg-surface-2 border-b border-hairline">
                  <p className="text-[10px] font-black text-ink uppercase tracking-wider">
                    Daily Invoices / Slips
                  </p>
                </div>
                {dailyVouchers?.items && dailyVouchers.items.length > 0 ? (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-hairline text-[9px]">
                        <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                          Invoice #
                        </th>
                        <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                          Customer
                        </th>
                        <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                          Vehicle
                        </th>
                        <th className="text-center px-3 py-1 text-ink-subtle font-bold">
                          Mode
                        </th>
                        <th className="text-right px-3 py-1 text-ink-subtle font-bold">
                          Qty (L)
                        </th>
                        <th className="text-right px-3 py-1 text-ink-subtle font-bold">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyVouchers.items.map((v) => (
                        <tr
                          key={v.uuid}
                          className="border-b border-hairline hover:bg-surface-2/50"
                        >
                          <td className="px-3 py-1 text-ink">{v.invoice_number}</td>
                          <td className="px-3 py-1 text-ink-muted font-sans">
                            {v.customer_name || "Cash"}
                          </td>
                          <td className="px-3 py-1 text-ink-subtle font-sans">
                            {v.vehicle_number || "—"}
                          </td>
                          <td className="px-3 py-1 text-center">
                            <Badge
                              className={`text-[8px] px-1.5 py-0 border-transparent font-bold ${
                                v.payment_mode === "CREDIT"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : v.payment_mode === "CASH"
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : "bg-blue-500/15 text-blue-600"
                              }`}
                            >
                              {v.payment_mode}
                            </Badge>
                          </td>
                          <td className="px-3 py-1 text-right text-ink-muted">
                            {fmt(Number(v.quantity_liters), 1)}
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-bold text-ink">
                            {fmt(Number(v.total_amount))}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-surface-3/20 font-bold border-t border-hairline">
                        <td colSpan={5} className="px-3 py-1.5 text-right text-ink">
                          Total
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-fuel-amber">
                          {fmt(grossFuelSales)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <div className="px-3 py-5 text-center text-xs text-ink-subtle italic">
                    No invoices found in this time window.
                  </div>
                )}
              </div>

              {/* Right: Cash flow panel */}
              <div>
                <div className="px-3 py-2 bg-surface-2 border-b border-hairline">
                  <p className="text-[10px] font-black text-ink uppercase tracking-wider">
                    Cash In (A) — Expected
                  </p>
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr className="border-b border-hairline">
                      <td className="px-3 py-1.5 text-ink font-semibold">Grand Total Nozzle Sales</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-ink">
                        {fmt(grossFuelSales)}
                      </td>
                    </tr>
                    <tr className="border-b border-hairline">
                      <td className="px-3 py-1.5 text-ink-muted">
                        (−) Credit Sales
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">
                        {fmt(creditSales)}
                      </td>
                    </tr>
                    <tr className="border-b border-hairline">
                      <td className="px-3 py-1.5 text-ink-muted">
                        (−) Digital (UPI/Card)
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">
                        {fmt(digitalSales)}
                      </td>
                    </tr>
                    <tr className="border-b-2 border-hairline bg-surface-3/20 font-bold">
                      <td className="px-3 py-2 text-ink">= Cash Sales</td>
                      <td className="px-3 py-2 text-right font-mono text-fuel-amber text-sm">
                        {fmt(cashSales)}
                      </td>
                    </tr>
                    {/* Payment mode breakdown */}
                    {grossFuelSales > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={2}
                            className="px-3 pt-2 pb-0.5 text-[9px] uppercase font-bold text-ink-subtle tracking-wider"
                          >
                            By Payment Mode
                          </td>
                        </tr>
                        {[
                          { mode: "CASH", amount: recordedCashSales },
                          { mode: "UPI", amount: upiSales },
                          { mode: "CARD", amount: cardSales },
                          { mode: "CREDIT", amount: creditSales },
                        ].map(({ mode, amount }) =>
                          amount > 0 ? (
                            <tr key={mode} className="border-b border-hairline">
                              <td className="px-3 py-0.5 text-ink-muted pl-5">
                                {mode}
                              </td>
                              <td className="px-3 py-0.5 text-right font-mono text-ink">
                                {fmt(amount)}
                              </td>
                            </tr>
                          ) : null
                        )}
                      </>
                    )}
                    {totalPaymentsReceived > 0 && (
                      <tr className="border-t border-hairline bg-surface-2">
                        <td className="px-3 py-1.5 text-ink font-semibold">
                          Customer Payments Received
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-ink">
                          {fmt(totalPaymentsReceived)}
                        </td>
                      </tr>
                    )}
                    {totalPaymentsReceived === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-2 text-center text-[10px] text-ink-subtle italic font-sans"
                        >
                          No customer payments on this date.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Expenses / Income */}
                <div className="no-print border-t border-hairline bg-surface-2/50 p-3 space-y-2">
                  <p className="text-[9px] uppercase font-bold text-ink-subtle tracking-wider">Expenses / Income</p>
                  <p className="text-[10px] text-ink-subtle">Income adds to the chosen payment mode; expense subtracts. Cash entries also adjust the expected cash handover.</p>

                  {expenses.length > 0 && (
                    <div className="space-y-1">
                      {expenses.map((e, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[10px] bg-surface-1 rounded px-2 py-1">
                          <select
                            value={e.type ?? "expense"}
                            onChange={(ev) => updateExpense(idx, { type: ev.target.value as ExpenseType })}
                            className={`bg-surface-1 border border-hairline rounded h-6 px-1 font-bold uppercase w-14 ${e.type === "income" ? "text-emerald-500" : "text-red-500"}`}
                          >
                            <option value="expense">− Out</option>
                            <option value="income">+ In</option>
                          </select>
                          <select
                            value={e.category}
                            onChange={(ev) => updateExpense(idx, { category: ev.target.value })}
                            className="flex-1 min-w-0 bg-surface-1 border border-hairline rounded h-6 px-1 text-ink"
                          >
                            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <select
                            value={e.payment_mode ?? "cash"}
                            onChange={(ev) => updateExpense(idx, { payment_mode: ev.target.value as ExpensePaymentMode })}
                            className="bg-surface-1 border border-hairline rounded h-6 px-1 uppercase text-ink-subtle w-16"
                          >
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="card">Card</option>
                            <option value="credit">Credit</option>
                          </select>
                          <Input
                            type="number" min="0" step="0.01"
                            value={e.amount}
                            onChange={(ev) => updateExpense(idx, { amount: Number(ev.target.value) || 0 })}
                            className="bg-surface-1 border-hairline h-6 px-1 text-right font-mono w-20 text-[10px]"
                          />
                          <button type="button" onClick={() => removeExpense(idx)} className="text-ink-subtle hover:text-red-500 shrink-0">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 items-end">
                    <label className="text-[10px] text-ink-muted">
                      Category
                      <select
                        value={newExpense.category}
                        onChange={(ev) => setNewExpense((p) => ({ ...p, category: ev.target.value }))}
                        className="mt-1 w-full bg-surface-1 border border-hairline rounded text-[11px] h-7 px-2 text-ink"
                      >
                        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="text-[10px] text-ink-muted">
                      Type
                      <select
                        value={newExpense.type}
                        onChange={(ev) => setNewExpense((p) => ({ ...p, type: ev.target.value as ExpenseType }))}
                        className="mt-1 w-full bg-surface-1 border border-hairline rounded text-[11px] h-7 px-2 text-ink"
                      >
                        <option value="expense">Expense (given)</option>
                        <option value="income">Income (received)</option>
                      </select>
                    </label>
                    <label className="text-[10px] text-ink-muted">
                      Payment mode
                      <select
                        value={newExpense.payment_mode}
                        onChange={(ev) => setNewExpense((p) => ({ ...p, payment_mode: ev.target.value as ExpensePaymentMode }))}
                        className="mt-1 w-full bg-surface-1 border border-hairline rounded text-[11px] h-7 px-2 text-ink"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="credit">Credit</option>
                      </select>
                    </label>
                    <label className="text-[10px] text-ink-muted">
                      Amount
                      <Input
                        type="number" min="0" step="0.01"
                        value={newExpense.amount}
                        onChange={(ev) => setNewExpense((p) => ({ ...p, amount: ev.target.value }))}
                        onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addExpense(); } }}
                        placeholder="0.00"
                        className="mt-1 bg-surface-1 border-hairline text-[11px] h-7 px-2 text-right font-mono"
                      />
                    </label>
                    <label className="text-[10px] text-ink-muted col-span-2">
                      Note (optional)
                      <Input
                        value={newExpense.description}
                        onChange={(ev) => setNewExpense((p) => ({ ...p, description: ev.target.value }))}
                        onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addExpense(); } }}
                        placeholder="e.g. paid to vendor"
                        className="mt-1 bg-surface-1 border-hairline text-[11px] h-7 px-2"
                      />
                    </label>
                  </div>
                  <Button type="button" onClick={addExpense} size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                    <Plus size={11} /> Add entry
                  </Button>
                </div>

                {/* Denomination cross-check (display only, not saved) */}
                <div className="no-print border-t border-hairline bg-surface-2/50 p-3 space-y-2">
                  <p className="text-[9px] uppercase font-bold text-ink-subtle tracking-wider">Cash Denomination</p>
                  <div className="grid grid-cols-3 gap-2">
                    {DENOMINATION_NOTES.map((note) => (
                      <label key={note} className="text-[10px] text-ink-muted flex items-center gap-1">
                        <span className="w-8 font-mono text-right">₹{note}</span>
                        <Input
                          type="number" min="0" step="1"
                          value={denomCounts[note] || ""}
                          onChange={(ev) => setDenomCounts((c) => ({ ...c, [note]: ev.target.value }))}
                          placeholder="0"
                          className="bg-surface-1 border-hairline text-[11px] h-7 px-2 text-right font-mono"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-between text-[11px] font-bold border-t border-hairline pt-1.5">
                    <span className="text-ink-subtle uppercase">Total Denomination</span>
                    <span className="font-mono text-ink">{fmtRs(denominationTotal)}</span>
                  </div>
                </div>

                {/* Payments log if any */}
                {dailyPayments?.items && dailyPayments.items.length > 0 && (
                  <table className="w-full text-[11px] border-t border-hairline">
                    <thead>
                      <tr className="border-b border-hairline text-[9px] bg-surface-2/60">
                        <th className="text-left px-3 py-1 text-ink-subtle font-bold">Customer</th>
                        <th className="text-center px-3 py-1 text-ink-subtle font-bold">Mode</th>
                        <th className="text-right px-3 py-1 text-ink-subtle font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyPayments.items.map((p) => (
                        <tr key={p.uuid} className="border-b border-hairline hover:bg-surface-2/50">
                          <td className="px-3 py-1 text-ink-muted font-sans">{p.customer_name}</td>
                          <td className="px-3 py-1 text-center">
                            <Badge className="text-[8px] px-1.5 py-0 border-transparent font-bold bg-fuel-amber/10 text-fuel-amber">
                              {p.payment_mode}
                            </Badge>
                          </td>
                          <td className="px-3 py-1 text-right font-mono font-bold text-ink">
                            {fmt(Number(p.amount))}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-surface-3/20 font-bold border-t border-hairline">
                        <td colSpan={2} className="px-3 py-1.5 text-right text-ink">Total Received</td>
                        <td className="px-3 py-1.5 text-right font-mono text-fuel-amber">{fmt(totalPaymentsReceived)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ── Footer summary ────────────────────────────────────────── */}
            <div className="border-t border-hairline px-4 py-2 bg-surface-2 flex items-center justify-between flex-wrap gap-3">
              <p className="text-[9px] text-ink-subtle font-mono">
                Preview for {createDate} · Window: {fmtDt(periodStart)} → {fmtDt(periodEnd)}
              </p>
              <div className="flex gap-4 text-[9px] font-mono">
                <span className="text-ink-subtle">
                  Gross Sales:{" "}
                  <strong className="text-ink">{fmtRs(grossFuelSales)}</strong>
                </span>
                <span className="text-ink-subtle">
                  Volume:{" "}
                  <strong className="text-ink">{fmt(grandTotalSold, 2)} L</strong>
                </span>
                {!hasData && (
                  <span className="text-ink-subtle italic">
                    No transactions in this window
                  </span>
                )}
              </div>

              {/* Generate button repeated at bottom for convenience */}
              {!sheetAlreadyExists && (
                <Button
                  type="button"
                  onClick={() => onGenerate(manualPaymentAmounts, expenses)}
                  disabled={isGenerating || isLoading}
                  size="sm"
                  className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-8 gap-1.5 cursor-pointer"
                >
                  <Zap size={12} />
                  {isGenerating ? "Generating…" : "Generate & Save"}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
