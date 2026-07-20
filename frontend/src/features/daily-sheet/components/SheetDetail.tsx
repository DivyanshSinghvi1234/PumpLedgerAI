import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Printer,
  Save,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2,
  Clock,
  MessageSquare,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import voucherService from "@/features/vouchers/services/voucherService";
import dailySheetService from "@/features/daily-sheet/services/dailySheetService";
import type {
  DailySheet,
  DailySheetExpense,
  DailySheetPaymentModeAmounts,
  ExpenseType,
  ExpensePaymentMode,
} from "@/features/daily-sheet/services/dailySheetService";
import type { FuelType } from "@/features/inventory/types";

/* ─────────────────────────────────────────────────────────────── helpers ── */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRs(n: number): string {
  return `₹${fmt(n)}`;
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  PETROL: "Petrol (MS)",
  DIESEL: "HSD (Diesel)",
  POWER_PETROL: "Power Petrol",
  POWER_DIESEL: "Power Diesel",
  CNG: "CNG",
};

// ₹2000 note excluded (demonetised from circulation).
const DENOMINATION_NOTES = [500, 200, 100, 50, 20, 10, 5, 2, 1];

const EXPENSE_CATEGORIES = [
  "Generator Fuel (DG)",
  "Staff Tea & Snacks",
  "Staff Salary Advance",
  "Station Maintenance",
  "Office Stationery",
  "Miscellaneous Petty Cash",
];

const EMPTY_MANUAL_PAYMENT_AMOUNTS: DailySheetPaymentModeAmounts = {
  cash: 0,
  upi: 0,
  card: 0,
  credit: 0,
};

/* ─────────────────────────────────────────────────────────────── types ──── */
interface SheetDetailProps {
  sheet: DailySheet;
  onClose: () => void;
  hideBackButton?: boolean;
}

interface DenominationEntry {
  note: number;
  count: string;
}

/* ═══════════════════════════════════════════════════════════════ component ═ */
export default function SheetDetail({
  sheet,
  onClose,
  hideBackButton,
}: SheetDetailProps) {
  const queryClient = useQueryClient();

  /* ── local state ───────────────────────────────────────────────────────── */
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [remarksInput, setRemarksInput] = useState(sheet.remarks || "");
  const [editingPeriod, setEditingPeriod] = useState(false);
  const [editDate, setEditDate] = useState(sheet.date);
  const [editPeriodStart, setEditPeriodStart] = useState(
    sheet.period_start || ""
  );
  const [editPeriodEnd, setEditPeriodEnd] = useState(sheet.period_end || "");

  // Counter expenses
  const [expenses, setExpenses] = useState<DailySheetExpense[]>([]);
  const [newCategory, setNewCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<ExpenseType>("expense");
  const [newPaymentMode, setNewPaymentMode] = useState<ExpensePaymentMode>("cash");

  // Physical cash handover
  const [actualCashInput, setActualCashInput] = useState<string>(
    sheet.actual_cash_collected !== null &&
      sheet.actual_cash_collected !== undefined
      ? String(sheet.actual_cash_collected)
      : ""
  );
  const [manualPaymentAmounts, setManualPaymentAmounts] =
    useState<DailySheetPaymentModeAmounts>(EMPTY_MANUAL_PAYMENT_AMOUNTS);

  // Denomination panel
  const [denominations, setDenominations] = useState<DenominationEntry[]>(
    DENOMINATION_NOTES.map((n) => ({ note: n, count: "" }))
  );

  /* ── query params ──────────────────────────────────────────────────────── */
  // Always filter by invoice_date (from_date/to_date) so vouchers are matched
  // by the date printed on the invoice — not by created_at (save timestamp).
  const voucherParams = {
    from_date: sheet.date,
    to_date: sheet.date,
    page_size: 200,
  };

  /* ── queries ───────────────────────────────────────────────────────────── */
  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["sheetReadings", sheet.uuid, sheet.date],
    queryFn: () => inventoryService.getBulkReadingsForm(sheet.date),
  });

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["sheetPayments", sheet.uuid, sheet.date],
    queryFn: () =>
      paymentService.getPayments({ payment_date: sheet.date, page_size: 200 }),
  });

  const { data: dailyVouchers, isLoading: vouchersLoading } = useQuery({
    queryKey: ["sheetVouchers", sheet.uuid, voucherParams],
    queryFn: () => voucherService.getVouchers(voucherParams),
  });

  const { data: reconciliation, isLoading: reconciliationLoading } = useQuery({
    queryKey: ["sheetReconciliation", sheet.uuid, sheet.date],
    queryFn: () => dailySheetService.getReconciliation(sheet.date),
  });

  // Shifts run 6:00 AM to 6:00 AM — look up active rates at 6:00 AM for today and yesterday.
  const { data: ratesMap } = useQuery({
    queryKey: ["sheetRatesMap", sheet.uuid, sheet.date],
    queryFn: async () => {
      const fuelTypes: FuelType[] = ["PETROL", "SPEED", "DIESEL", "LUBRICANT"];
      
      const [y, m, d] = sheet.date.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() - 1);
      const yesterdayStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

      const todayMap: Record<string, number> = { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };
      const yesterdayMap: Record<string, number> = { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };

      const rateTimeToday = new Date(`${sheet.date}T06:00:00`).toISOString();
      const rateTimeYesterday = new Date(`${yesterdayStr}T06:00:00`).toISOString();

      await Promise.all(
        fuelTypes.map(async (ft) => {
          try {
            const res = await inventoryService.getActiveRate(ft, rateTimeToday);
            todayMap[ft] = Number(res.rate);
          } catch {
            todayMap[ft] = 0;
          }
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

  /* ── sync state from server ────────────────────────────────────────────── */
  useEffect(() => {
    if (reconciliation?.expenses?.length) {
      setExpenses(reconciliation.expenses);
    } else if (sheet.expenses_data) {
      try {
        setExpenses(JSON.parse(sheet.expenses_data));
      } catch {
        setExpenses([]);
      }
    }
    if (
      reconciliation?.actual_cash_collected !== null &&
      reconciliation?.actual_cash_collected !== undefined
    ) {
      setActualCashInput(String(reconciliation.actual_cash_collected));
    }
    if (reconciliation?.manual_payment_mode_amounts) {
      setManualPaymentAmounts(reconciliation.manual_payment_mode_amounts);
    }
  }, [reconciliation, sheet]);

  /* ── Derived nozzle groups calculation with split support ──────────────── */
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
        testing: number;
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
      const testing = 0; // testing quantity - reserved for future
      const sold = closing !== null && closing >= opening ? closing - opening - testing : 0;
      
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
        testing,
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

  const nozzleGroupTotals = useMemo(() => {
    return Object.entries(nozzleGroups).map(([ft, rows]) => ({
      fuel_type: ft,
      totalTesting: rows.reduce((s, r) => s + r.testing, 0),
      totalSold: rows.reduce((s, r) => s + r.sold, 0),
      totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    }));
  }, [nozzleGroups]);

  const grandTotalNozzleAmount = useMemo(
    () => nozzleGroupTotals.reduce((s, g) => s + g.totalAmount, 0),
    [nozzleGroupTotals]
  );

  // Financial engine
  const grossFuelSales =
    reconciliation?.gross_fuel_sales ?? grandTotalNozzleAmount;
  const recordedByMode = reconciliation?.recorded_amount_by_mode ?? {};
  // Per-mode net of the live expenses list: income adds, expense subtracts.
  // Mirrors the backend so per-mode totals + cash handover recompute as rows
  // are edited before re-save. Legacy rows default to expense / cash.
  const expenseNetByMode = useMemo(() => {
    const m: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 };
    for (const e of expenses) {
      const key = (e.payment_mode ?? "cash").toUpperCase();
      if (!(key in m)) continue;
      const amt = Number(e.amount || 0);
      m[key] += (e.type ?? "expense") === "income" ? amt : -amt;
    }
    return m;
  }, [expenses]);
  // Displayed per-mode totals = recorded sales net of income/expense in that mode.
  const cashSales = (recordedByMode.CASH ?? 0) + expenseNetByMode.CASH;
  const upiSales = (recordedByMode.UPI ?? 0) + expenseNetByMode.UPI;
  const cardSales = (recordedByMode.CARD ?? 0) + expenseNetByMode.CARD;
  const creditSales = (recordedByMode.CREDIT ?? 0) + expenseNetByMode.CREDIT;
  const digitalSales = upiSales + cardSales;

  // total_expenses shown on the sheet counts expense-type rows only (income excluded).
  const totalCounterExpenses = useMemo(
    () =>
      expenses.reduce(
        (s, e) => ((e.type ?? "expense") === "expense" ? s + Number(e.amount || 0) : s),
        0
      ),
    [expenses]
  );

  // Cash-handover formula (mirrors backend): credit/digital are recorded sales
  // only (money never in the drawer); only cash-mode income/expense moves cash.
  const recordedCreditForCash = recordedByMode.CREDIT ?? 0;
  const recordedDigitalForCash = (recordedByMode.UPI ?? 0) + (recordedByMode.CARD ?? 0);
  const expectedCash =
    grossFuelSales -
    recordedCreditForCash -
    recordedDigitalForCash +
    expenseNetByMode.CASH;
  const parsedActualCash =
    actualCashInput !== "" ? parseFloat(actualCashInput) : null;
  const cashVariance =
    parsedActualCash !== null ? parsedActualCash - expectedCash : null;

  // Denomination total
  const denominationTotal = useMemo(
    () =>
      denominations.reduce((s, d) => {
        const count = parseInt(d.count || "0", 10) || 0;
        return s + d.note * count;
      }, 0),
    [denominations]
  );

  // Total payments received
  const totalPaymentsReceived = useMemo(
    () =>
      dailyPayments?.items?.reduce((s, p) => s + Number(p.amount), 0) ?? 0,
    [dailyPayments]
  );

  /* ── mutations ─────────────────────────────────────────────────────────── */
  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File }) =>
      dailySheetService.uploadManualSheet(sheet.uuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      toast.success("Manual sheet image uploaded!");
    },
    onError: () => toast.error("Failed to upload manual sheet image."),
  });

  const updateSheetMutation = useMutation({
    mutationFn: (options: {
      remarks?: string;
      date?: string;
      period_start?: string;
      period_end?: string;
      actual_cash_collected?: number | null;
      expenses?: DailySheetExpense[];
      manual_payment_mode_amounts?: DailySheetPaymentModeAmounts;
    }) => dailySheetService.updateDailySheet(sheet.uuid, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      queryClient.invalidateQueries({
        queryKey: ["sheetReconciliation", sheet.uuid, sheet.date],
      });
      queryClient.invalidateQueries({
        queryKey: ["sheetReadings", sheet.uuid],
      });
      queryClient.invalidateQueries({
        queryKey: ["sheetPayments", sheet.uuid],
      });
      queryClient.invalidateQueries({
        queryKey: ["sheetVouchers", sheet.uuid],
      });
      setEditingRemarks(false);
      setEditingPeriod(false);
      toast.success("Daily sheet saved!");
    },
    onError: () => toast.error("Failed to save daily sheet."),
  });

  /* ── handlers ──────────────────────────────────────────────────────────── */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      uploadMutation.mutate({ file: e.target.files[0] });
    }
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid expense amount.");
      return;
    }
    const item: DailySheetExpense = {
      category: newCategory,
      description: newDesc || newCategory,
      amount: amt,
      type: newType,
      payment_mode: newPaymentMode,
    };
    setExpenses((prev) => [...prev, item]);
    setNewDesc("");
    setNewAmount("");
  };

  const handleRemoveExpense = (idx: number) =>
    setExpenses((prev) => prev.filter((_, i) => i !== idx));

  const updateExpense = (idx: number, patch: Partial<DailySheetExpense>) =>
    setExpenses((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));

  const handleSave = () => {
    updateSheetMutation.mutate({
      actual_cash_collected: parsedActualCash,
      expenses,
      manual_payment_mode_amounts: manualPaymentAmounts,
      remarks: remarksInput || undefined,
    });
  };

  const setDenomCount = (idx: number, val: string) => {
    setDenominations((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, count: val } : d))
    );
  };

  const isLoading =
    salesFormLoading ||
    paymentsLoading ||
    vouchersLoading ||
    reconciliationLoading;

  const fuelTypeKeys = Object.keys(nozzleGroups);

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-0 print:space-y-0">
      {/* ── Toolbar (no-print) ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-4 no-print flex-wrap">
        <div className="flex items-center gap-2">
          {!hideBackButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-ink-muted hover:text-ink h-8 text-xs gap-1.5 cursor-pointer"
            >
              <ChevronLeft size={14} /> Back to Sheets
            </Button>
          )}
          <Badge className="text-[9px] uppercase font-mono font-bold bg-success/15 text-success hover:bg-success/15 border-transparent">
            Active Sheet
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit Timing */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingPeriod((p) => !p)}
            className="border-hairline bg-surface-2 hover:bg-surface-3 text-xs h-8 text-ink font-semibold"
          >
            <Clock size={13} className="mr-1.5 text-fuel-amber" />
            {editingPeriod ? "Cancel Edit" : "Edit Timing"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSheetMutation.isPending}
            size="sm"
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-8 gap-1.5 cursor-pointer"
          >
            <Save size={13} /> Save Changes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="border-hairline bg-surface-2 hover:bg-surface-3 text-xs h-8 text-ink font-semibold"
          >
            <Printer size={13} className="mr-1.5 text-fuel-amber" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Edit Period Panel (no-print) */}
      {editingPeriod && (
        <div className="no-print border border-hairline rounded-lg p-4 bg-surface-2 space-y-3 mb-4">
          <h4 className="text-xs font-bold text-ink">Edit Sheet Timing & Date</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">
                Accounting Date
              </Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-surface-1 border-hairline text-sm h-9 px-3 rounded-lg text-ink"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">
                Period Start
              </Label>
              <Input
                type="datetime-local"
                value={
                  editPeriodStart
                    ? toDatetimeLocal(new Date(editPeriodStart))
                    : ""
                }
                onChange={(e) =>
                  setEditPeriodStart(new Date(e.target.value).toISOString())
                }
                className="bg-surface-1 border-hairline text-sm h-9 px-3 rounded-lg text-ink"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">
                Period End
              </Label>
              <Input
                type="datetime-local"
                value={
                  editPeriodEnd ? toDatetimeLocal(new Date(editPeriodEnd)) : ""
                }
                onChange={(e) =>
                  setEditPeriodEnd(new Date(e.target.value).toISOString())
                }
                className="bg-surface-1 border-hairline text-sm h-9 px-3 rounded-lg text-ink"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={() =>
                updateSheetMutation.mutate({
                  date: editDate,
                  period_start: editPeriodStart,
                  period_end: editPeriodEnd,
                })
              }
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold h-8 text-xs"
            >
              Save Timeline
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DAILY SUMMARY REPORT — print-friendly single card                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="border border-hairline rounded-xl bg-surface-1 overflow-hidden print:border-gray-400 print:rounded-none print:shadow-none"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
      >
        {/* ── Report Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-hairline bg-surface-2 print:bg-white print:border-gray-300">
          <div>
            <p className="text-[11px] font-bold text-ink-subtle">
              Date :{" "}
              <span className="text-ink italic">
                {new Date(sheet.date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </p>
            <p className="text-[10px] text-ink-subtle mt-0.5">
              <Clock size={10} className="inline mr-1" />
              {fmtDt(sheet.period_start)} → {fmtDt(sheet.period_end)}
            </p>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-black text-ink tracking-tight">
              Daily Summary Report
            </h1>
            <p className="text-[10px] text-ink-subtle font-sans">
              Petrol Pump Management System
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-ink-subtle">
              Shift :{" "}
              <span className="text-ink">All</span>
            </p>
            <p className="text-[10px] text-ink-subtle mt-0.5">
              {isLoading ? "Loading..." : "Computed"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs text-ink-subtle">
            Retrieving daily transaction logs & calculations…
          </div>
        ) : (
          <>
            {/* ── Section 1: Nozzle Meter Readings ─────────────────────── */}
            {fuelTypeKeys.length > 0 ? (
              fuelTypeKeys.map((ft) => {
                const rows = nozzleGroups[ft];
                const totals = nozzleGroupTotals.find(
                  (g) => g.fuel_type === ft
                )!;
                return (
                  <div key={ft} className="overflow-x-auto print:overflow-visible">
                    <table className="w-full min-w-[560px] print:min-w-0 border-collapse text-[11px]">
                      <thead>
                        <tr className="border-y border-hairline bg-surface-2 print:bg-gray-50 print:border-gray-300">
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
                            className="border-b border-hairline print:border-gray-200 hover:bg-surface-2/50"
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
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right text-ink-subtle">
                              {fmt(row.testing, 1)}
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
                        {/* Group total row */}
                        <tr className="border-y border-hairline bg-surface-3/30 print:bg-gray-100 print:border-gray-400 font-bold">
                          <td
                            colSpan={3}
                            className="px-3 py-1.5 text-center text-ink"
                          >
                            Total — {FUEL_TYPE_LABELS[ft] ?? ft}
                          </td>
                          <td className="px-3 py-1.5 text-right text-ink">
                            {fmt(totals.totalTesting, 1)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-ink">
                            {fmt(totals.totalSold, 2)}
                          </td>
                          <td className="px-3 py-1.5 text-right" />
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
              <div className="px-4 py-6 text-center text-xs text-ink-subtle italic border-b border-hairline">
                No nozzle meter readings found for this date. Record meter
                readings in the Inventory section.
              </div>
            )}

            {/* Grand total bar */}
            {fuelTypeKeys.length > 1 && (
              <div className="flex items-center justify-between px-4 py-2 bg-fuel-amber/10 border-y-2 border-fuel-amber/30 print:border-gray-400 print:bg-yellow-50">
                <span className="text-xs font-black text-ink uppercase tracking-wider">
                  Grand Total — All Fuel Sales
                </span>
                <span className="text-sm font-black text-fuel-amber font-mono">
                  {fmtRs(grandTotalNozzleAmount)}
                </span>
              </div>
            )}

            {/* ── Section 2: Tank Dip Reconciliation ───────────────────── */}
            {reconciliation?.tanks && reconciliation.tanks.length > 0 ? (
              <div>
                {reconciliation.tanks.map((tank) => (
                  <table
                    key={tank.tank_uuid}
                    className="w-full border-collapse text-[11px] border-t border-hairline print:border-gray-300"
                  >
                    <thead>
                      <tr className="border-b border-hairline bg-surface-2 print:bg-gray-50 print:border-gray-300">
                        <th className="text-left px-3 py-1.5 font-bold text-ink">
                          Tank
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Op. Dip
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Qty
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Cl. Dip
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Qty
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Purch.
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Dip Sale
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Meter Sale
                        </th>
                        <th className="text-right px-3 py-1.5 font-bold text-ink">
                          Variation
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        className={`border-b border-hairline print:border-gray-200 ${
                          tank.requires_review ? "bg-red-500/5" : ""
                        }`}
                      >
                        <td className="px-3 py-1.5 font-semibold text-ink">
                          {tank.tank_name}
                          <span className="ml-1 text-[9px] text-ink-subtle">
                            ({tank.fuel_type})
                          </span>
                        </td>
                        {/* Opening dip — we don't have the raw mm, show — */}
                        <td className="px-3 py-1.5 text-right text-ink-subtle">
                          —
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink">
                          {fmt(tank.opening_dip_liters, 1)}
                        </td>
                        {/* Closing dip — show — for mm */}
                        <td className="px-3 py-1.5 text-right text-ink-subtle">
                          —
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink">
                          {fmt(tank.closing_dip_liters, 1)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink">
                          {fmt(tank.deliveries_liters, 1)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink font-semibold">
                          {fmt(tank.dip_sales_liters, 2)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink font-semibold">
                          {fmt(tank.nozzle_sales_liters, 2)}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-bold ${
                            tank.requires_review
                              ? "text-red-500"
                              : Math.abs(tank.physical_leak_variance) < 0.01
                              ? "text-ink-subtle"
                              : "text-ink"
                          }`}
                        >
                          {fmt(
                            tank.dip_sales_liters - tank.nozzle_sales_liters,
                            2
                          )}
                        </td>
                      </tr>
                      {/* Tank subtotal */}
                      <tr className="border-b border-hairline bg-surface-3/20 print:bg-gray-50 font-bold text-[10px]">
                        <td className="px-3 py-1 text-ink">Total</td>
                        <td />
                        <td className="px-3 py-1 text-right text-ink">
                          {fmt(tank.opening_dip_liters, 1)}
                        </td>
                        <td />
                        <td className="px-3 py-1 text-right text-ink">
                          {fmt(tank.closing_dip_liters, 1)}
                        </td>
                        <td className="px-3 py-1 text-right text-ink">
                          {fmt(tank.deliveries_liters, 1)}
                        </td>
                        <td className="px-3 py-1 text-right text-ink">
                          {fmt(tank.dip_sales_liters, 2)}
                        </td>
                        <td className="px-3 py-1 text-right text-ink">
                          {fmt(tank.nozzle_sales_liters, 2)}
                        </td>
                        <td className="px-3 py-1 text-right text-ink">
                          {fmt(
                            tank.dip_sales_liters - tank.nozzle_sales_liters,
                            2
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </div>
            ) : (
              <div className="px-4 py-4 text-center text-xs text-ink-subtle italic border-t border-hairline">
                No tank dip readings found. Add dip readings in the Inventory →
                Tank Dips section.
              </div>
            )}

            {/* ── Section 3: Bottom 3-Panel Row ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 border-t-2 border-hairline print:border-gray-400 divide-y lg:divide-y-0 lg:divide-x divide-hairline print:divide-gray-300">
              
              {/* LEFT: Counter Expenses / Cash Deposits */}
              <div className="p-0">
                <div className="px-3 py-2 border-b border-hairline bg-surface-2 print:bg-gray-50 print:border-gray-300">
                  <p className="text-[10px] font-black text-ink uppercase tracking-wider text-center">
                    Counter Expenses
                  </p>
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                        Description
                      </th>
                      <th className="text-right px-3 py-1 text-ink-subtle font-bold">
                        Amount
                      </th>
                      <th className="w-6 no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length > 0 ? (
                      expenses.map((exp, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-hairline print:border-gray-200 hover:bg-surface-2/50"
                        >
                          <td className="px-3 py-1.5">
                            {/* Print: static text. Screen: inline-editable controls. */}
                            <p className="hidden print:block text-ink font-semibold">
                              {exp.category}
                              <span className="ml-1.5 text-[8px] uppercase font-bold text-ink-subtle">
                                {(exp.payment_mode ?? "cash")}
                                {(exp.type ?? "expense") === "income" ? " · in" : ""}
                              </span>
                            </p>
                            {exp.description !== exp.category && (
                              <p className="hidden print:block text-[9px] text-ink-subtle">
                                {exp.description}
                              </p>
                            )}
                            <div className="no-print space-y-1">
                              <div className="flex gap-1">
                                <select
                                  value={exp.category}
                                  onChange={(ev) => updateExpense(idx, { category: ev.target.value })}
                                  className="flex-1 min-w-0 bg-surface-1 border border-hairline rounded text-[10px] text-ink px-1 py-0.5 outline-none focus:border-fuel-amber"
                                >
                                  {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <select
                                  value={exp.type ?? "expense"}
                                  onChange={(ev) => updateExpense(idx, { type: ev.target.value as ExpenseType })}
                                  className="bg-surface-1 border border-hairline rounded text-[10px] text-ink px-1 py-0.5 outline-none focus:border-fuel-amber"
                                >
                                  <option value="expense">Out</option>
                                  <option value="income">In</option>
                                </select>
                                <select
                                  value={exp.payment_mode ?? "cash"}
                                  onChange={(ev) => updateExpense(idx, { payment_mode: ev.target.value as ExpensePaymentMode })}
                                  className="bg-surface-1 border border-hairline rounded text-[10px] text-ink px-1 py-0.5 outline-none focus:border-fuel-amber"
                                >
                                  <option value="cash">Cash</option>
                                  <option value="upi">UPI</option>
                                  <option value="card">Card</option>
                                  <option value="credit">Credit</option>
                                </select>
                              </div>
                              <Input
                                type="text"
                                placeholder="Note"
                                value={exp.description === exp.category ? "" : exp.description}
                                onChange={(ev) => updateExpense(idx, { description: ev.target.value || exp.category })}
                                className="bg-surface-1 border-hairline text-[10px] h-6 px-1.5 text-ink w-full"
                              />
                            </div>
                          </td>
                          <td className={`px-3 py-1.5 text-right font-mono ${(exp.type ?? "expense") === "income" ? "text-emerald-500" : "text-ink"}`}>
                            <span className="hidden print:inline">
                              {(exp.type ?? "expense") === "income" ? "+" : ""}{fmt(exp.amount)}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              value={exp.amount}
                              onChange={(ev) => updateExpense(idx, { amount: parseFloat(ev.target.value) || 0 })}
                              className="no-print bg-surface-1 border-hairline text-[10px] h-6 px-1.5 text-right font-mono w-20 ml-auto"
                            />
                          </td>
                          <td className="py-1.5 pr-2 no-print">
                            <button
                              type="button"
                              onClick={() => handleRemoveExpense(idx)}
                              className="text-ink-subtle hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-3 py-3 text-center text-ink-subtle italic"
                        >
                          No expenses recorded
                        </td>
                      </tr>
                    )}
                    {/* Total row */}
                    {expenses.length > 0 && (
                      <tr className="border-t border-hairline bg-surface-3/20 print:bg-gray-50 font-bold">
                        <td className="px-3 py-1.5 text-ink">Total</td>
                        <td className="px-3 py-1.5 text-right font-mono text-fuel-amber">
                          {fmt(totalCounterExpenses)}
                        </td>
                        <td className="no-print" />
                      </tr>
                    )}
                    {/* Customer Payments received */}
                    {totalPaymentsReceived > 0 && (
                      <tr className="border-t border-hairline bg-surface-2 print:bg-gray-50">
                        <td className="px-3 py-1.5 font-semibold text-ink">
                          Customer Payments
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink">
                          {fmt(totalPaymentsReceived)}
                        </td>
                        <td className="no-print" />
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Add expense form (no-print) */}
                <form
                  onSubmit={handleAddExpense}
                  className="no-print p-3 border-t border-hairline bg-surface-2/50 space-y-2"
                >
                  <p className="text-[9px] uppercase font-bold text-ink-subtle tracking-wider">
                    Add Expense / Income
                  </p>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-surface-1 border border-hairline rounded text-[11px] text-ink p-1.5 outline-none focus:border-fuel-amber"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1.5">
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as ExpenseType)}
                      className="flex-1 bg-surface-1 border border-hairline rounded text-[11px] text-ink p-1.5 outline-none focus:border-fuel-amber"
                    >
                      <option value="expense">Expense (given)</option>
                      <option value="income">Income (received)</option>
                    </select>
                    <select
                      value={newPaymentMode}
                      onChange={(e) => setNewPaymentMode(e.target.value as ExpensePaymentMode)}
                      className="flex-1 bg-surface-1 border border-hairline rounded text-[11px] text-ink p-1.5 outline-none focus:border-fuel-amber"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      type="text"
                      placeholder="Description"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="bg-surface-1 border-hairline text-[11px] h-7 px-2 text-ink flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="₹0.00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="bg-surface-1 border-hairline text-[11px] h-7 px-2 text-ink w-20 font-mono"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas h-7 px-2 text-[11px] font-bold"
                    >
                      <Plus size={11} />
                    </Button>
                  </div>
                </form>
              </div>

              {/* CENTER: Payment mode reconciliation and Cash In(A) flow */}
              <div className="p-0">
                <div className="px-3 py-2 border-b border-hairline bg-surface-2 print:bg-gray-50 print:border-gray-300">
                  <p className="text-[10px] font-black text-ink uppercase tracking-wider text-center">
                    Payment Mode & Cash In (A)
                  </p>
                </div>
                <table className="w-full text-[11px]">
                  <tbody>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink font-semibold">Grand Total Nozzle Sales</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-ink">
                        {fmt(grossFuelSales)}
                      </td>
                    </tr>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink">Cash — Recorded</td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">{fmt(cashSales)}</td>
                    </tr>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink">UPI — Recorded</td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">{fmt(upiSales)}</td>
                    </tr>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink">Card — Recorded</td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">{fmt(cardSales)}</td>
                    </tr>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink-muted">
                        (−) Credit Sales
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">
                        {fmt(creditSales)}
                      </td>
                    </tr>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink-muted">
                        (−) Digital (UPI/Card)
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">
                        {fmt(digitalSales)}
                      </td>
                    </tr>
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink-muted">
                        (−) Counter Expenses
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-ink">
                        {fmt(totalCounterExpenses)}
                      </td>
                    </tr>
                    <tr className="border-b-2 border-hairline bg-surface-3/20 print:bg-gray-50 print:border-gray-400 font-bold">
                      <td className="px-3 py-2 text-ink">
                        = Expected Cash
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-fuel-amber text-sm">
                        {fmt(expectedCash)}
                      </td>
                    </tr>
                    {/* Actual cash input */}
                    <tr className="border-b border-hairline print:border-gray-200">
                      <td className="px-3 py-1.5 text-ink font-semibold">
                        Actual Cash (Physical)
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={actualCashInput}
                          onChange={(e) => setActualCashInput(e.target.value)}
                          className="no-print bg-surface-1 border-hairline text-[11px] h-7 px-2 text-ink font-mono w-full text-right"
                        />
                        <span className="hidden print:block font-mono text-ink">
                          {actualCashInput || "—"}
                        </span>
                      </td>
                    </tr>
                    {/* Shortage / Excess */}
                    {cashVariance !== null && (
                      <tr
                        className={`border-b border-hairline font-bold ${
                          cashVariance < 0
                            ? "bg-red-500/10 print:bg-red-50"
                            : "bg-emerald-500/10 print:bg-green-50"
                        }`}
                      >
                        <td
                          className={`px-3 py-1.5 flex items-center gap-1.5 ${
                            cashVariance < 0
                              ? "text-red-500"
                              : "text-emerald-600"
                          }`}
                        >
                          {cashVariance < 0 ? (
                            <AlertCircle size={12} />
                          ) : (
                            <CheckCircle size={12} />
                          )}
                          {cashVariance < 0
                            ? "Cash Shortage"
                            : cashVariance === 0
                            ? "Exact Match"
                            : "Cash Excess"}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-mono ${
                            cashVariance < 0
                              ? "text-red-500"
                              : "text-emerald-600"
                          }`}
                        >
                          {cashVariance < 0 ? "−" : "+"}{fmt(Math.abs(cashVariance))}
                        </td>
                      </tr>
                    )}
                    {/* Denomination cross-check */}
                    {denominationTotal > 0 && (
                      <tr
                        className={`border-b border-hairline text-[10px] ${
                          Math.abs(denominationTotal - (parsedActualCash ?? 0)) < 1
                            ? "text-emerald-600"
                            : "text-ink-muted"
                        }`}
                      >
                        <td className="px-3 py-1 italic">Denomination Total</td>
                        <td className="px-3 py-1 text-right font-mono">
                          {fmt(denominationTotal)}
                        </td>
                      </tr>
                    )}
                    {/* Payment mode breakdown */}
                    {reconciliation?.billed_amount_by_mode && (
                      <>
                        <tr>
                          <td
                            colSpan={2}
                            className="px-3 pt-2 pb-0.5 text-[9px] uppercase font-bold text-ink-subtle tracking-wider"
                          >
                            By Payment Mode
                          </td>
                        </tr>
                        {Object.entries(
                          reconciliation.billed_amount_by_mode
                        ).map(([mode, amount]) =>
                          amount > 0 ? (
                            <tr
                              key={mode}
                              className="border-b border-hairline print:border-gray-100"
                            >
                              <td className="px-3 py-0.5 text-ink-muted pl-5">
                                {mode}
                              </td>
                              <td className="px-3 py-0.5 text-right font-mono text-ink">
                                {fmt(Number(amount))}
                              </td>
                            </tr>
                          ) : null
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* RIGHT: Denomination Entry */}
              <div className="p-0">
                <div className="px-3 py-2 border-b border-hairline bg-surface-2 print:bg-gray-50 print:border-gray-300">
                  <p className="text-[10px] font-black text-ink uppercase tracking-wider text-center">
                    Denomination
                  </p>
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-hairline print:border-gray-200 text-[9px]">
                      <th className="px-3 py-1 text-left text-ink-subtle font-bold">
                        Note (₹)
                      </th>
                      <th className="px-3 py-1 text-center text-ink-subtle font-bold">
                        × Count
                      </th>
                      <th className="px-3 py-1 text-right text-ink-subtle font-bold">
                        = Value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {denominations.map((d, idx) => {
                      const count = parseInt(d.count || "0", 10) || 0;
                      const value = d.note * count;
                      return (
                        <tr
                          key={d.note}
                          className="border-b border-hairline print:border-gray-100"
                        >
                          <td className="px-3 py-0.5 font-mono font-bold text-ink">
                            {d.note.toLocaleString("en-IN")} ★
                          </td>
                          <td className="px-2 py-0.5 text-center">
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={d.count}
                              onChange={(e) =>
                                setDenomCount(idx, e.target.value)
                              }
                              className="no-print bg-surface-1 border-hairline text-[11px] h-6 px-2 text-ink font-mono text-center w-full"
                            />
                            <span className="hidden print:block font-mono text-center text-ink">
                              {d.count || "0"}
                            </span>
                          </td>
                          <td className="px-3 py-0.5 text-right font-mono text-ink">
                            {value > 0 ? fmt(value, 0) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Denomination Total */}
                    <tr className="border-t-2 border-hairline bg-surface-3/20 print:bg-gray-50 print:border-gray-400 font-bold">
                      <td colSpan={2} className="px-3 py-1.5 text-ink">
                        Total Denomination
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-mono ${
                          denominationTotal > 0 &&
                          parsedActualCash !== null &&
                          Math.abs(denominationTotal - parsedActualCash) < 1
                            ? "text-emerald-600"
                            : "text-fuel-amber"
                        }`}
                      >
                        {fmt(denominationTotal, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 4: Invoices & Payments (collapsible detail) ───── */}
            <div className="border-t border-hairline print:border-gray-300">
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-hairline print:divide-gray-200">
                {/* Credit & All Invoices */}
                <div>
                  <div className="px-3 py-2 bg-surface-2 border-b border-hairline print:bg-gray-50 print:border-gray-300">
                    <p className="text-[10px] font-black text-ink uppercase tracking-wider">
                      Daily Invoices / Slips
                    </p>
                  </div>
                  {dailyVouchers?.items && dailyVouchers.items.length > 0 ? (
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-hairline print:border-gray-200 text-[9px]">
                          <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                            Invoice #
                          </th>
                          <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                            Customer
                          </th>
                          <th className="text-center px-3 py-1 text-ink-subtle font-bold">
                            Mode
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
                            className="border-b border-hairline print:border-gray-100 hover:bg-surface-2/50"
                          >
                            <td className="px-3 py-1 font-mono text-ink">
                              {v.invoice_number}
                            </td>
                            <td className="px-3 py-1 text-ink-muted">
                              {v.customer_name || "Cash"}
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
                            <td className="px-3 py-1 text-right font-mono font-bold text-ink">
                              {fmt(Number(v.total_amount))}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-surface-3/20 print:bg-gray-100 font-bold border-t border-hairline">
                          <td
                            colSpan={3}
                            className="px-3 py-1.5 text-right text-ink"
                          >
                            Total
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-fuel-amber">
                            {fmt(
                              dailyVouchers.items.reduce(
                                (s, v) => s + Number(v.total_amount),
                                0
                              )
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-ink-subtle italic">
                      No invoices for this date.
                    </div>
                  )}
                </div>

                {/* Customer Payments Received */}
                <div>
                  <div className="px-3 py-2 bg-surface-2 border-b border-hairline print:bg-gray-50 print:border-gray-300">
                    <p className="text-[10px] font-black text-ink uppercase tracking-wider">
                      Customer Payments Received
                    </p>
                  </div>
                  {dailyPayments?.items && dailyPayments.items.length > 0 ? (
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-hairline print:border-gray-200 text-[9px]">
                          <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                            Ref
                          </th>
                          <th className="text-left px-3 py-1 text-ink-subtle font-bold">
                            Customer
                          </th>
                          <th className="text-center px-3 py-1 text-ink-subtle font-bold">
                            Mode
                          </th>
                          <th className="text-right px-3 py-1 text-ink-subtle font-bold">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyPayments.items.map((p) => (
                          <tr
                            key={p.uuid}
                            className="border-b border-hairline print:border-gray-100 hover:bg-surface-2/50"
                          >
                            <td className="px-3 py-1 font-mono text-ink-subtle">
                              {p.reference_number || p.payment_date || "—"}
                            </td>
                            <td className="px-3 py-1 text-ink-muted">
                              {p.customer_name}
                            </td>
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
                        <tr className="bg-surface-3/20 print:bg-gray-100 font-bold border-t border-hairline">
                          <td
                            colSpan={3}
                            className="px-3 py-1.5 text-right text-ink"
                          >
                            Total Received
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-fuel-amber">
                            {fmt(totalPaymentsReceived)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-3 py-4 text-center text-xs text-ink-subtle italic">
                      No customer payments received on this date.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 5: Remarks & Manual Scan ─────────────────────── */}
            <div className="border-t border-hairline print:border-gray-300 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-hairline">
              {/* Remarks */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-ink uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare size={11} className="text-fuel-amber" />
                    Manager Notes
                  </p>
                  {!editingRemarks && (
                    <button
                      onClick={() => {
                        setRemarksInput(sheet.remarks || "");
                        setEditingRemarks(true);
                      }}
                      className="no-print text-[10px] text-fuel-amber hover:underline font-semibold cursor-pointer"
                    >
                      [Edit]
                    </button>
                  )}
                </div>
                {editingRemarks ? (
                  <div className="no-print space-y-2">
                    <Textarea
                      value={remarksInput}
                      onChange={(e) => setRemarksInput(e.target.value)}
                      placeholder="Add remarks or notes…"
                      className="bg-surface-2 border-hairline text-[11px] min-h-[60px] text-ink"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRemarks(false)}
                        className="h-7 text-xs text-ink-subtle"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          updateSheetMutation.mutate({ remarks: remarksInput })
                        }
                        className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold h-7 text-xs"
                      >
                        Save Notes
                      </Button>
                    </div>
                  </div>
                ) : sheet.remarks ? (
                  <p className="text-[11px] text-ink leading-relaxed italic bg-surface-2/40 p-2 rounded border border-hairline">
                    "{sheet.remarks}"
                  </p>
                ) : (
                  <p className="text-[11px] text-ink-subtle italic">
                    No remarks added.
                  </p>
                )}
              </div>

              {/* Manual Sheet Scan */}
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-black text-ink uppercase tracking-wider flex items-center gap-1">
                  <ImageIcon size={11} className="text-fuel-amber" />
                  Physical Sheet Scan
                </p>
                {sheet.manual_sheet_image ? (
                  <div className="relative aspect-[4/3] max-h-40 rounded overflow-hidden border border-hairline bg-surface-2 group">
                    <img
                      src={dailySheetService.resolveImageUrl(sheet.manual_sheet_image) ?? ""}
                      alt="Manual Sheet Scan"
                      className="w-full h-full object-cover"
                    />
                    <div className="no-print absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <a
                        href={dailySheetService.resolveImageUrl(sheet.manual_sheet_image) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-canvas hover:bg-surface-3 text-ink text-xs font-bold px-3 py-1.5 rounded shadow cursor-pointer"
                      >
                        View Full
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="no-print border-2 border-dashed border-hairline rounded p-3 text-center space-y-1">
                    <p className="text-[11px] text-ink-muted">
                      Attach digital copy of physical sheet
                    </p>
                    <Label
                      htmlFor="manual-sheet-upload"
                      className="inline-flex items-center gap-1.5 bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-3 py-1 rounded text-[11px] cursor-pointer"
                    >
                      <Upload size={11} /> Upload Scan
                    </Label>
                    <Input
                      id="manual-sheet-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Report Footer ─────────────────────────────────────────── */}
            <div className="border-t border-hairline print:border-gray-400 px-4 py-2 bg-surface-2 print:bg-white flex items-center justify-between flex-wrap gap-2">
              <p className="text-[9px] text-ink-subtle font-mono">
                Generated by PumpLedger AI · {sheet.date} · {fmtDt(sheet.period_start)} to {fmtDt(sheet.period_end)}
              </p>
              <div className="flex gap-3 text-[9px] text-ink-subtle font-mono">
                <span>Gross Sales: {fmtRs(grossFuelSales)}</span>
                <span>Expected Cash: {fmtRs(expectedCash)}</span>
                {cashVariance !== null && (
                  <span
                    className={
                      cashVariance < 0 ? "text-red-500 font-bold" : "text-emerald-600 font-bold"
                    }
                  >
                    {cashVariance < 0 ? "Shortage" : "Excess"}: {fmtRs(Math.abs(cashVariance))}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
