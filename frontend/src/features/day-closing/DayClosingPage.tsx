import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Moon,
  Droplets,
  Calculator,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import dayClosingService from "./services/dayClosingService";

export default function DayClosingPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useCurrentUser();
  const isAdmin = hasRole("ADMIN");

  const [closingDate, setClosingDate] = useState(getTodayDateString());
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Tank dip overrides keyed by tank_uuid
  const [dipInputs, setDipInputs] = useState<Record<string, string>>({});

  // Step 2: Cash count & float
  const [openingFloatOverride, setOpeningFloatOverride] = useState<string | null>(null);
  const [cashToNextDay, setCashToNextDay] = useState("0");
  const [directCashCount, setDirectCashCount] = useState("");
  const [notes500, setNotes500] = useState("0");
  const [notes200, setNotes200] = useState("0");
  const [notes100, setNotes100] = useState("0");
  const [notes50, setNotes50] = useState("0");
  const [notes20, setNotes20] = useState("0");
  const [notes10, setNotes10] = useState("0");
  const [coins, setCoins] = useState("0");

  // Step 3: Notes & Bank Sync
  const [notes, setNotes] = useState("");
  const [settlementBankUuid, setSettlementBankUuid] = useState("");
  const [upiBankUuid, setUpiBankUuid] = useState("");
  const [cardBankUuid, setCardBankUuid] = useState("");
  const [cashDepositedToBank, setCashDepositedToBank] = useState("0");

  const { data: draft, isLoading } = useQuery({
    queryKey: ["day-closing-draft", closingDate],
    queryFn: () => dayClosingService.getDraft(closingDate),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["day-closings-history"],
    queryFn: () => dayClosingService.listClosings(30),
  });

  const denomCashTotal = useMemo(() => {
    return (
      (Number(notes500) || 0) * 500 +
      (Number(notes200) || 0) * 200 +
      (Number(notes100) || 0) * 100 +
      (Number(notes50) || 0) * 50 +
      (Number(notes20) || 0) * 20 +
      (Number(notes10) || 0) * 10 +
      (Number(coins) || 0)
    );
  }, [notes500, notes200, notes100, notes50, notes20, notes10, coins]);

  const physicalCash = denomCashTotal > 0 ? denomCashTotal : Number(directCashCount) || 0;
  const openingFloat = openingFloatOverride !== null
    ? Number(openingFloatOverride) || 0
    : Number(draft?.opening_float ?? 0);

  const expectedCash = useMemo(() => {
    if (!draft) return 0;
    return (
      openingFloat +
      Number(draft.cash_sales) -
      Number(draft.cash_expenses) -
      (Number(cashToNextDay) || 0)
    );
  }, [draft, openingFloat, cashToNextDay]);

  const variance = physicalCash - expectedCash;

  const tankDipsPayload = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [uuid, val] of Object.entries(dipInputs)) {
      if (val.trim() !== "" && !Number.isNaN(Number(val))) {
        out[uuid] = Number(val);
      }
    }
    return out;
  }, [dipInputs]);

  const closeMutation = useMutation({
    mutationFn: () =>
      dayClosingService.closeDay({
        closing_date: closingDate,
        opening_float: openingFloat,
        physical_cash_counted: physicalCash,
        cash_to_next_day: Number(cashToNextDay) || 0,
        notes_500: Number(notes500) || 0,
        notes_200: Number(notes200) || 0,
        notes_100: Number(notes100) || 0,
        notes_50: Number(notes50) || 0,
        notes_20: Number(notes20) || 0,
        notes_10: Number(notes10) || 0,
        coins: Number(coins) || 0,
        tank_dips: tankDipsPayload,
        settlement_bank_account_uuid: settlementBankUuid || null,
        upi_bank_account_uuid: upiBankUuid || null,
        card_bank_account_uuid: cardBankUuid || null,
        cash_deposited_to_bank: Number(cashDepositedToBank) || 0,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`Business day ${closingDate} closed and synced.`);
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", closingDate] });
      queryClient.invalidateQueries({ queryKey: ["day-closings-history"] });
      queryClient.invalidateQueries({ queryKey: ["stock-variance-daily"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to close business day.");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (uuid: string) => dayClosingService.reopenClosing(uuid),
    onSuccess: () => {
      toast.success("Business day reopened for edits.");
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", closingDate] });
      queryClient.invalidateQueries({ queryKey: ["day-closings-history"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to reopen closing.");
    },
  });

  const handleDateChange = (nextDate: string) => {
    setClosingDate(nextDate);
    setStep(1);
    setDipInputs({});
    setOpeningFloatOverride(null);
    setDirectCashCount("");
    setNotes500("0");
    setNotes200("0");
    setNotes100("0");
    setNotes50("0");
    setNotes20("0");
    setNotes10("0");
    setCoins("0");
    setCashToNextDay("0");
    setNotes("");
    setSettlementBankUuid("");
    setUpiBankUuid("");
    setCardBankUuid("");
    setCashDepositedToBank("0");
  };

  if (isLoading && !draft) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="One-Click Day Closing"
          description="Auto-computes meter sales, cash/UPI/card/credit totals, expenses, and tank stock variance."
        />
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={closingDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
          />
          {draft?.already_closed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-500">
              <Lock className="h-3.5 w-3.5" /> Locked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-amber-500">
              <Moon className="h-3.5 w-3.5" /> Open Day
            </span>
          )}
        </div>
      </div>

      {/* Already Closed Banner */}
      {draft?.already_closed && draft.existing_closing_uuid && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Business day <strong>{closingDate}</strong> is closed and locked against voucher or expense edits.
            </span>
          </div>
          {isAdmin && (
            <button
              type="button"
              disabled={reopenMutation.isPending}
              onClick={() => reopenMutation.mutate(draft.existing_closing_uuid!)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300 hover:bg-amber-500/25 cursor-pointer"
            >
              <LockOpen className="h-3.5 w-3.5" /> Reopen Day (Admin)
            </button>
          )}
        </div>
      )}

      {/* Warnings strip */}
      {draft && draft.warnings.length > 0 && (
        <div className="space-y-2">
          {draft.warnings.map((w, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
                w.severity === "ERROR"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3-Step Wizard Stepper */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { num: 1 as const, label: "1. Verify Readings & Dips" },
          { num: 2 as const, label: "2. Cash Count" },
          { num: 3 as const, label: "3. Review & Close" },
        ].map((item) => (
          <button
            key={item.num}
            type="button"
            onClick={() => setStep(item.num)}
            className={`rounded-xl border px-4 py-3 text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              step === item.num
                ? "border-fuel-amber bg-fuel-amber/15 text-ink"
                : "border-hairline bg-surface-1 text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* STEP 1: Verify Readings & Tank Dips */}
      {step === 1 && draft && (
        <div className="space-y-6">
          <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-ink">Nozzle Meter Sales (Auto-Fetched)</h2>
                <p className="text-xs text-ink-muted">
                  Gross Meter Sales: <span className="font-mono font-bold text-ink">{formatCurrency(draft.gross_meter_sales)}</span>
                </p>
              </div>
              <Link
                to="/dashboard/inventory"
                className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-2/80"
              >
                Edit Meter Readings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-surface-2 text-ink-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Nozzle</th>
                    <th className="px-3 py-2 text-left">Fuel</th>
                    <th className="px-3 py-2 text-right">Opening</th>
                    <th className="px-3 py-2 text-right">Closing</th>
                    <th className="px-3 py-2 text-right">Sales (L)</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.nozzle_lines.map((n) => (
                    <tr key={n.nozzle_uuid} className="border-t border-hairline">
                      <td className="px-3 py-2 font-medium text-ink">{n.nozzle_name}</td>
                      <td className="px-3 py-2">{n.fuel_type}</td>
                      <td className="px-3 py-2 text-right font-mono">{n.opening_reading.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {n.closing_reading !== null ? n.closing_reading.toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{n.sales_liters.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(n.rate)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(n.amount)}</td>
                      <td className="px-3 py-2 text-center">
                        {n.missing_reading ? (
                          <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500">
                            Missing
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {draft.nozzle_lines.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-ink-muted">
                        No nozzles configured yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tank Dips Section */}
          <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-fuel-amber" />
              <div>
                <h2 className="text-sm font-bold text-ink">Tank Physical Dips (Stock Loss Check)</h2>
                <p className="text-xs text-ink-muted">
                  Enter physical dip reading in litres to automatically verify against book stock.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {draft.tank_dips.map((t) => {
                const rawVal = dipInputs[t.tank_uuid] ?? (t.physical_dip !== null ? String(t.physical_dip) : "");
                const parsedDip = rawVal.trim() !== "" ? Number(rawVal) : null;
                const liveVar = parsedDip !== null && !Number.isNaN(parsedDip)
                  ? parsedDip - t.book_stock
                  : t.variance_liters;

                return (
                  <div key={t.tank_uuid} className="rounded-lg border border-hairline bg-surface-2 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">{t.tank_name}</span>
                      <span className="text-[11px] font-mono rounded bg-surface-1 px-2 py-0.5 text-ink-muted">
                        {t.fuel_type}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-ink-muted">
                      <span>Book Stock:</span>
                      <span className="font-mono font-semibold text-ink">{t.book_stock.toFixed(1)} L</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-ink-muted mb-1">
                        Physical Dip (Litres)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        disabled={draft.already_closed}
                        value={rawVal}
                        onChange={(e) =>
                          setDipInputs((prev) => ({ ...prev, [t.tank_uuid]: e.target.value }))
                        }
                        placeholder="Enter dip in L..."
                        className="w-full rounded border border-hairline bg-surface-1 px-3 py-1.5 text-sm font-mono text-ink"
                      />
                    </div>
                    {liveVar !== null && liveVar !== undefined && (
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-ink-muted">Variance:</span>
                        <span
                          className={`font-mono font-bold ${
                            Math.abs(liveVar) > t.book_stock * 0.005 ? "text-rose-500" : "text-emerald-500"
                          }`}
                        >
                          {liveVar > 0 ? "+" : ""}
                          {liveVar.toFixed(1)} L
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {draft.tank_dips.length === 0 && (
                <p className="text-xs text-ink-muted">No active fuel tanks configured.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-fuel-amber px-5 py-2.5 text-sm font-semibold text-canvas hover:bg-fuel-amber/90 cursor-pointer"
            >
              Next: Cash Count <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Cash Count */}
      {step === 2 && draft && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
            <h2 className="text-sm font-bold text-ink">Denomination Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "₹500", val: notes500, set: setNotes500 },
                { label: "₹200", val: notes200, set: setNotes200 },
                { label: "₹100", val: notes100, set: setNotes100 },
                { label: "₹50", val: notes50, set: setNotes50 },
                { label: "₹20", val: notes20, set: setNotes20 },
                { label: "₹10", val: notes10, set: setNotes10 },
                { label: "Coins (₹)", val: coins, set: setCoins },
              ].map((d) => (
                <div key={d.label}>
                  <label className="block text-xs text-ink-muted mb-1">{d.label}</label>
                  <input
                    type="number"
                    min="0"
                    disabled={draft.already_closed}
                    value={d.val}
                    onChange={(e) => d.set(e.target.value)}
                    className="w-full rounded border border-hairline bg-surface-2 px-3 py-1.5 text-sm font-mono text-ink"
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-hairline pt-4">
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Or enter total Physical Cash Counted directly (₹)
              </label>
              <input
                type="number"
                step="0.01"
                disabled={draft.already_closed || denomCashTotal > 0}
                value={denomCashTotal > 0 ? String(denomCashTotal) : directCashCount}
                onChange={(e) => setDirectCashCount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-hairline bg-surface-2 px-3 py-2 text-base font-mono font-bold text-ink disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs text-ink-muted mb-1">Opening Float (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={draft.already_closed}
                  value={openingFloatOverride !== null ? openingFloatOverride : String(draft.opening_float)}
                  onChange={(e) => setOpeningFloatOverride(e.target.value)}
                  className="w-full rounded border border-hairline bg-surface-2 px-3 py-1.5 text-sm font-mono text-ink"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-1">Cash Handed to Next Day (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  disabled={draft.already_closed}
                  value={cashToNextDay}
                  onChange={(e) => setCashToNextDay(e.target.value)}
                  className="w-full rounded border border-hairline bg-surface-2 px-3 py-1.5 text-sm font-mono text-ink"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-ink">Live Cash Reconciliation</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Opening Float</span>
                  <span className="font-mono">{formatCurrency(openingFloat)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">+ Cash Voucher Sales</span>
                  <span className="font-mono text-emerald-500">+{formatCurrency(draft.cash_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">− Cash Expenses</span>
                  <span className="font-mono text-rose-500">−{formatCurrency(draft.cash_expenses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">− Cash to Next Day</span>
                  <span className="font-mono">−{formatCurrency(Number(cashToNextDay) || 0)}</span>
                </div>
                <div className="border-t border-hairline pt-2 flex justify-between font-semibold">
                  <span>Expected Cash in Hand</span>
                  <span className="font-mono">{formatCurrency(expectedCash)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Physical Cash Counted</span>
                  <span className="font-mono">{formatCurrency(physicalCash)}</span>
                </div>
                <div className="border-t border-hairline pt-2 flex justify-between text-base font-bold">
                  <span>Variance (Shortage / Excess)</span>
                  <span className={`font-mono ${variance < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                    {variance > 0 ? "+" : ""}
                    {formatCurrency(variance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-4 py-2 text-sm font-medium text-ink cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 rounded-lg bg-fuel-amber px-5 py-2 text-sm font-semibold text-canvas hover:bg-fuel-amber/90 cursor-pointer"
              >
                Review & Close <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Review & Close */}
      {step === 3 && draft && (
        <div className="rounded-xl border border-hairline bg-surface-1 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-hairline bg-surface-2 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-ink-muted">Meter & Voucher Totals</p>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Gross Meter Sales</span>
                <span className="font-mono font-bold">{formatCurrency(draft.gross_meter_sales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Total Billed Vouchers</span>
                <span className="font-mono font-bold">{formatCurrency(draft.total_voucher_sales)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-hairline bg-surface-2 p-4 space-y-1.5 text-xs">
              <p className="text-xs font-semibold uppercase text-ink-muted mb-1">Collections Breakdown</p>
              <div className="flex justify-between">
                <span>Cash</span>
                <span className="font-mono font-semibold">{formatCurrency(draft.cash_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span>UPI ({draft.upi_count} txns)</span>
                <span className="font-mono font-semibold">{formatCurrency(draft.upi_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card EDC ({draft.card_count} txns)</span>
                <span className="font-mono font-semibold">{formatCurrency(draft.card_sales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Credit ({draft.credit_count} slips)</span>
                <span className="font-mono font-semibold">{formatCurrency(draft.credit_sales)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-hairline bg-surface-2 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-ink-muted">Cash Closing</p>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Expected Cash</span>
                <span className="font-mono">{formatCurrency(expectedCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-muted">Actual Counted</span>
                <span className="font-mono">{formatCurrency(physicalCash)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-hairline pt-1.5">
                <span>Variance</span>
                <span className={`font-mono ${variance < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                  {variance > 0 ? "+" : ""}
                  {formatCurrency(variance)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-hairline bg-surface-2 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted">
                  Auto-Sync to Bank Account
                </p>
                <p className="text-xs text-ink-muted">
                  UPI + Card ({formatCurrency(Number(draft.upi_sales) + Number(draft.card_sales))}) will auto-credit to your selected (or primary) bank account.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <BankAccountSelect
                value={settlementBankUuid}
                onChange={setSettlementBankUuid}
                label="Default / Cash Deposit Bank (Optional)"
              />
              <BankAccountSelect
                value={upiBankUuid}
                onChange={setUpiBankUuid}
                label="UPI Settlement Bank (e.g. SBI — Optional)"
              />
              <BankAccountSelect
                value={cardBankUuid}
                onChange={setCardBankUuid}
                label="Card EDC Bank (e.g. HDFC — Optional)"
              />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink-muted">
                    Cash Deposited to Bank Today (₹)
                  </label>
                  <button
                    type="button"
                    disabled={draft.already_closed}
                    onClick={() => {
                      const excess = Math.max(0, physicalCash - (Number(cashToNextDay) || 0));
                      setCashDepositedToBank(String(excess.toFixed(2)));
                    }}
                    className="text-[11px] font-semibold text-fuel-amber hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Deposit Excess ({formatCurrency(Math.max(0, physicalCash - (Number(cashToNextDay) || 0)))})
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={draft.already_closed}
                  value={cashDepositedToBank}
                  onChange={(e) => setCashDepositedToBank(e.target.value)}
                  className="w-full rounded-md border border-hairline bg-surface-1 px-3 py-2 text-xs font-mono font-semibold text-ink outline-none focus:border-fuel-amber"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">Closing Notes (Optional)</label>
            <textarea
              rows={2}
              disabled={draft.already_closed}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any handover remarks, dip observations, or shortage explanations..."
              className="w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 px-4 py-2 text-sm font-medium text-ink cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {!draft.already_closed && (
              <button
                type="button"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <Calculator className="h-4 w-4" />
                {closeMutation.isPending ? "Closing Day..." : "Save & Close Day"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-3">
        <h3 className="text-sm font-bold text-ink">Recent Day Closings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-surface-2 text-ink-muted uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Meter Sales</th>
                <th className="px-3 py-2 text-right">Voucher Sales</th>
                <th className="px-3 py-2 text-right">Cash Counted</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-center">Status</th>
                {isAdmin && <th className="px-3 py-2 text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {history.map((c) => (
                <tr key={c.uuid} className="border-t border-hairline">
                  <td className="px-3 py-2 font-medium text-ink">{c.closing_date}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(c.gross_meter_sales)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(c.total_voucher_sales)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(c.physical_cash_counted)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${Number(c.variance) < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                    {formatCurrency(c.variance)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        c.status === "LOCKED" || c.status === "CLOSED"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      {(c.status === "LOCKED" || c.status === "CLOSED") && (
                        <button
                          type="button"
                          onClick={() => reopenMutation.mutate(c.uuid)}
                          className="text-xs font-semibold text-amber-500 hover:underline cursor-pointer"
                        >
                          Reopen
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-3 py-6 text-center text-ink-muted">
                    No closed days recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
