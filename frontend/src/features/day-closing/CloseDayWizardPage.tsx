import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Fuel,
  Landmark,
  Lock,
  Moon,
  ShieldCheck,
  Sparkles,
  Unlock,
  Wand2,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import dayClosingService from "./services/dayClosingService";
import inventoryService from "@/features/inventory/services/inventoryService";
import { pipelineService } from "@/features/pipeline/services/pipelineService";
import { formatCurrency, getTodayDateString } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Meters & Dips", icon: Fuel },
  { id: 2, title: "5-Point Audit", icon: Sparkles },
  { id: 3, title: "Cash Drawer", icon: Banknote },
  { id: 4, title: "Bank Deposit", icon: Landmark },
  { id: 5, title: "Verify & Lock", icon: ShieldCheck },
] as const;

export default function CloseDayWizardPage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [step, setStep] = useState<number>(1);

  // Step 1 inline nozzle closing inputs & tank dips
  const [nozzleInputs, setNozzleInputs] = useState<Record<string, string>>({});
  const [tankDips, setTankDips] = useState<Record<string, string>>({});

  // Step 3 denominations
  const [notes500, setNotes500] = useState(0);
  const [notes200, setNotes200] = useState(0);
  const [notes100, setNotes100] = useState(0);
  const [notes50, setNotes50] = useState(0);
  const [notes20, setNotes20] = useState(0);
  const [notes10, setNotes10] = useState(0);
  const [coins, setCoins] = useState(0);
  const [cashToNextDay, setCashToNextDay] = useState("5000");

  // Step 4 bank deposit
  const [settlementBankUuid, setSettlementBankUuid] = useState("");
  const [cashDepositedToBank, setCashDepositedToBank] = useState("0");
  const [closingNotes, setClosingNotes] = useState("");

  const { data: draft, isLoading: draftLoading } = useQuery({
    queryKey: ["day-closing-draft", selectedDate],
    queryFn: () => dayClosingService.getDraft(selectedDate),
  });

  const { data: snapshot } = useQuery({
    queryKey: ["daily-snapshot", selectedDate],
    queryFn: () => pipelineService.getSnapshot(selectedDate),
  });

  const { data: audit } = useQuery({
    queryKey: ["five-point-audit", selectedDate],
    queryFn: () => pipelineService.get5PointAudit(selectedDate),
  });

  // Pre-fill tank dips from draft
  useEffect(() => {
    if (!draft) return;
    setTankDips((prev) => {
      const next = { ...prev };
      for (const td of draft.tank_dips) {
        if (next[td.tank_uuid] === undefined) {
          next[td.tank_uuid] = td.physical_dip !== null ? String(td.physical_dip) : String(Math.round(td.book_stock));
        }
      }
      return next;
    });
  }, [draft]);

  // Pre-fill denominations from snapshot if available
  useEffect(() => {
    if (!snapshot) return;
    const d = snapshot.cash_proof.denominations;
    if (d && (d.notes_500 || d.notes_200 || d.notes_100 || d.notes_50)) {
      setNotes500(d.notes_500);
      setNotes200(d.notes_200);
      setNotes100(d.notes_100);
      setNotes50(d.notes_50);
      setNotes20(d.notes_20);
      setNotes10(d.notes_10);
      setCoins(d.coins);
    }
  }, [snapshot]);

  const countedCash = useMemo(
    () =>
      notes500 * 500 +
      notes200 * 200 +
      notes100 * 100 +
      notes50 * 50 +
      notes20 * 20 +
      notes10 * 10 +
      coins,
    [notes500, notes200, notes100, notes50, notes20, notes10, coins]
  );

  const { data: preLock } = useQuery({
    queryKey: ["pre-lock-check", selectedDate, countedCash, cashToNextDay],
    queryFn: () =>
      pipelineService.getPreLockCheck({
        target_date: selectedDate,
        physical_cash_counted: countedCash,
        cash_to_next_day: Number(cashToNextDay) || 0,
        notes: closingNotes || undefined,
      }),
    enabled: step === 5,
  });

  const saveMissingMetersMutation = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const toSave = draft.nozzle_lines
        .filter((n) => n.missing_reading && nozzleInputs[n.nozzle_uuid])
        .map((n) => ({
          nozzle_uuid: n.nozzle_uuid,
          opening_reading: n.opening_reading,
          closing_reading: Number(nozzleInputs[n.nozzle_uuid]),
          testing_liters: 0,
          return_testing_to_storage: true,
        }));
      if (toSave.length === 0) {
        toast.info("Enter at least one closing meter reading.");
        return;
      }
      await inventoryService.postBulkReadings({
        reading_date: selectedDate,
        readings: toSave,
      });
      toast.success(`Saved ${toSave.length} nozzle reading(s)!`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["five-point-audit", selectedDate] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to save meters"),
  });

  const autoBalanceMutation = useMutation({
    mutationFn: () => pipelineService.autoBalanceCash(selectedDate),
    onSuccess: () => {
      toast.success("Unbilled cash fuel auto-balanced!");
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["five-point-audit", selectedDate] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Auto-balance failed"),
  });

  const lockDayMutation = useMutation({
    mutationFn: async () => {
      const dipMap: Record<string, number> = {};
      for (const [uuid, val] of Object.entries(tankDips)) {
        const num = Number(val);
        if (Number.isFinite(num)) dipMap[uuid] = num;
      }
      return dayClosingService.closeDay({
        closing_date: selectedDate,
        opening_float: draft?.opening_float ?? 0,
        physical_cash_counted: countedCash,
        cash_to_next_day: Number(cashToNextDay) || 0,
        notes_500: notes500,
        notes_200: notes200,
        notes_100: notes100,
        notes_50: notes50,
        notes_20: notes20,
        notes_10: notes10,
        coins,
        tank_dips: dipMap,
        settlement_bank_account_uuid: settlementBankUuid || null,
        cash_deposited_to_bank: Number(cashDepositedToBank) || 0,
        notes: closingNotes || null,
      });
    },
    onSuccess: () => {
      toast.success("Day closed and locked!");
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["five-point-audit", selectedDate] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to lock day"),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!draft?.existing_closing_uuid) return;
      return dayClosingService.reopenClosing(draft.existing_closing_uuid);
    },
    onSuccess: () => {
      toast.success("Day closing reopened for editing.");
      queryClient.invalidateQueries({ queryKey: ["day-closing-draft", selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", selectedDate] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to reopen"),
  });

  if (draftLoading || !draft) {
    return <LoadingState />;
  }

  const missingCount = draft.nozzle_lines.filter((n) => n.missing_reading).length;
  const expectedCash = snapshot?.cash_proof.expected_drawer_cash ?? draft.opening_float + draft.cash_sales - draft.cash_expenses;
  const drawerVariance = countedCash - expectedCash;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guided Close-the-Day Wizard"
        description="5-step end-of-day reconciliation: nozzle meters, 5-point audit, cash drawer count, bank deposit & lock."
        action={
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-40"
            />
            <Link to="/dashboard/day-closing">
              <Button variant="outline" size="sm">
                Classic View
              </Button>
            </Link>
          </div>
        }
      />

      {/* Already Closed Banner */}
      {draft.already_closed && (
        <div className="bento-card border-emerald-500/40 bg-emerald-500/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
              <Lock size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                {selectedDate} is Locked &amp; Closed
              </h2>
              <p className="text-xs text-ink-muted">
                Meter Sales: {formatCurrency(draft.gross_meter_sales)} · Voucher Sales:{" "}
                {formatCurrency(draft.total_voucher_sales)}
              </p>
            </div>
          </div>
          {draft.existing_closing_uuid && (
            <Button
              variant="outline"
              size="sm"
              disabled={reopenMutation.isPending}
              onClick={() => reopenMutation.mutate()}
            >
              <Unlock size={14} className="mr-1.5" />
              Reopen Day
            </Button>
          )}
        </div>
      )}

      {/* Visual 5-Step Progress Stepper */}
      <div className="bento-card p-4">
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const completed = step > s.id || draft.already_closed;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "bg-fuel-orange text-white shadow-sm"
                    : completed
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : "bg-surface-2 text-ink-muted hover:text-ink"
                }`}
              >
                <Icon size={15} className="shrink-0" />
                <span className="hidden md:inline truncate">
                  {s.id}. {s.title}
                </span>
                <span className="md:hidden">{s.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content Card */}
      <div className="bento-card p-6 space-y-5">
        {/* STEP 1: METERS & DIPS */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-ink">Step 1: Nozzle Meter Readings &amp; Tank Dips</h3>
                <p className="text-xs text-ink-muted">
                  {missingCount === 0
                    ? "All nozzles have closing readings for today."
                    : `${missingCount} nozzle(s) still need a closing meter reading.`}
                </p>
              </div>
              {missingCount > 0 && (
                <Button
                  size="sm"
                  disabled={saveMissingMetersMutation.isPending}
                  onClick={() => saveMissingMetersMutation.mutate()}
                >
                  Save Entered Readings
                </Button>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-ink-subtle uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Nozzle</th>
                    <th className="px-3 py-2.5 text-left">Fuel</th>
                    <th className="px-3 py-2.5 text-right">Opening</th>
                    <th className="px-3 py-2.5 text-right">Closing</th>
                    <th className="px-3 py-2.5 text-right">Sales (L)</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {draft.nozzle_lines.map((n) => (
                    <tr key={n.nozzle_uuid} className="hover:bg-surface-2/40">
                      <td className="px-3 py-2.5 font-semibold text-ink">{n.nozzle_name}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{n.fuel_type}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {n.opening_reading.toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {n.missing_reading ? (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Closing..."
                            value={nozzleInputs[n.nozzle_uuid] ?? ""}
                            onChange={(e) =>
                              setNozzleInputs((prev) => ({
                                ...prev,
                                [n.nozzle_uuid]: e.target.value,
                              }))
                            }
                            className="h-7 w-28 ml-auto text-right font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono font-bold text-ink tabular-nums">
                            {n.closing_reading?.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-500 tabular-nums">
                        {n.sales_liters.toFixed(1)} L
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-ink tabular-nums">
                        {formatCurrency(n.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tank Dips */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                Physical Tank Dips (Liters)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {draft.tank_dips.map((td) => (
                  <div key={td.tank_uuid} className="rounded-xl border border-hairline bg-surface-2/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">{td.tank_name}</span>
                      <span className="text-ink-muted">Book: {Math.round(td.book_stock)} L</span>
                    </div>
                    <Input
                      type="number"
                      value={tankDips[td.tank_uuid] ?? ""}
                      onChange={(e) =>
                        setTankDips((prev) => ({ ...prev, [td.tank_uuid]: e.target.value }))
                      }
                      placeholder="Physical Dip (L)"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: 5-POINT AUDIT & UNBILLED CASH */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">Step 2: 5-Point Auto-Audit &amp; Unbilled Cash</h3>
                <p className="text-xs text-ink-muted">
                  Ensure meter sales match billed vouchers before counting cash.
                </p>
              </div>
              {snapshot && snapshot.vouchers.unbilled_cash_fuel > 1 && (
                <Button
                  size="sm"
                  disabled={autoBalanceMutation.isPending}
                  onClick={() => autoBalanceMutation.mutate()}
                >
                  <Wand2 size={14} className="mr-1.5" />
                  Auto-Balance {formatCurrency(snapshot.vouchers.unbilled_cash_fuel)} Cash
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(audit?.checks ?? []).map((chk) => (
                <div
                  key={chk.id}
                  className={`rounded-xl border p-4 flex items-start gap-3 ${
                    chk.status === "OK"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-amber-500/40 bg-amber-500/10"
                  }`}
                >
                  {chk.status === "OK" ? (
                    <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-ink">{chk.title}</p>
                      <span className="text-xs font-mono font-bold tabular-nums text-ink-muted">
                        Diff: {formatCurrency(chk.difference)}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">{chk.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: CASH DRAWER & DENOMINATIONS */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-ink">Step 3: Physical Cash Drawer Count</h3>
                <p className="text-xs text-ink-muted">
                  Count physical notes and coins in the drawer.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-ink-subtle">Expected: </span>
                  <span className="font-bold text-ink tabular-nums">{formatCurrency(expectedCash)}</span>
                </div>
                <div>
                  <span className="text-ink-subtle">Counted: </span>
                  <span className="font-bold text-emerald-500 tabular-nums">{formatCurrency(countedCash)}</span>
                </div>
                <div>
                  <span className="text-ink-subtle">Variance: </span>
                  <span
                    className={`font-bold tabular-nums ${
                      Math.abs(drawerVariance) <= 50 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    {formatCurrency(drawerVariance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "₹500", val: notes500, set: setNotes500, mult: 500 },
                { label: "₹200", val: notes200, set: setNotes200, mult: 200 },
                { label: "₹100", val: notes100, set: setNotes100, mult: 100 },
                { label: "₹50", val: notes50, set: setNotes50, mult: 50 },
                { label: "₹20", val: notes20, set: setNotes20, mult: 20 },
                { label: "₹10", val: notes10, set: setNotes10, mult: 10 },
                { label: "Coins (₹)", val: coins, set: setCoins, mult: 1 },
              ].map((d) => (
                <div key={d.label} className="rounded-xl border border-hairline bg-surface-2/60 p-3 space-y-1.5">
                  <Label className="text-xs font-bold">{d.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={d.val}
                    onChange={(e) => d.set(Math.max(0, Number(e.target.value) || 0))}
                    className="h-9 font-mono text-sm"
                  />
                  <p className="text-[11px] text-ink-subtle tabular-nums">
                    = {formatCurrency(d.val * d.mult)}
                  </p>
                </div>
              ))}
            </div>

            <div className="max-w-xs space-y-1.5">
              <Label>Cash Retained for Tomorrow&apos;s Float (₹)</Label>
              <Input
                type="number"
                value={cashToNextDay}
                onChange={(e) => setCashToNextDay(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* STEP 4: BANK DEPOSIT & DIGITAL */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-ink">Step 4: Bank Deposit &amp; Digital Settlement</h3>
              <p className="text-xs text-ink-muted">
                Review UPI/Card collections and record cash deposited to bank.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-hairline bg-surface-2/50 p-4">
                <p className="text-xs text-ink-subtle">UPI Sales</p>
                <p className="text-xl font-bold text-blue-500 tabular-nums mt-1">
                  {formatCurrency(draft.upi_sales)}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-surface-2/50 p-4">
                <p className="text-xs text-ink-subtle">Card / Bank Sales</p>
                <p className="text-xl font-bold text-purple-500 tabular-nums mt-1">
                  {formatCurrency(draft.card_sales + draft.bank_sales)}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-surface-2/50 p-4">
                <p className="text-xs text-ink-subtle">Credit Issued</p>
                <p className="text-xl font-bold text-amber-500 tabular-nums mt-1">
                  {formatCurrency(draft.credit_sales)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Settlement / Deposit Bank Account</Label>
                <BankAccountSelect
                  value={settlementBankUuid}
                  onChange={setSettlementBankUuid}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cash Deposited to Bank Today (₹)</Label>
                <Input
                  type="number"
                  value={cashDepositedToBank}
                  onChange={(e) => setCashDepositedToBank(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Closing Remarks (Optional)</Label>
              <Input
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Any shift notes, short-cash reason, or bank deposit reference..."
              />
            </div>
          </div>
        )}

        {/* STEP 5: PRE-LOCK SAFETY GATE & LOCK */}
        {step === 5 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-ink">Step 5: Pre-Lock Safety Gate</h3>
              <p className="text-xs text-ink-muted">
                Final automated verification before locking {selectedDate}.
              </p>
            </div>

            <div className="space-y-2">
              {(preLock?.checkpoints ?? []).map((cp) => (
                <div
                  key={cp.id}
                  className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                    cp.passed
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-rose-500/40 bg-rose-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {cp.passed ? (
                      <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle size={17} className="text-rose-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-ink">{cp.title}</p>
                      <p className="text-xs text-ink-muted">{cp.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-hairline">
              <div className="text-xs text-ink-muted">
                Counted Cash: <strong className="text-ink">{formatCurrency(countedCash)}</strong> · Variance:{" "}
                <strong className={Math.abs(drawerVariance) <= 50 ? "text-emerald-500" : "text-rose-500"}>
                  {formatCurrency(drawerVariance)}
                </strong>
              </div>
              <Button
                disabled={draft.already_closed || lockDayMutation.isPending}
                onClick={() => lockDayMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Moon size={15} className="mr-1.5" />
                {lockDayMutation.isPending ? "Locking Day..." : "Lock & Close Day"}
              </Button>
            </div>
          </div>
        )}

        {/* Stepper Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-hairline">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft size={14} className="mr-1.5" />
            Previous
          </Button>
          <span className="text-xs font-medium text-ink-subtle">
            Step {step} of {STEPS.length}
          </span>
          <Button
            type="button"
            size="sm"
            disabled={step === STEPS.length}
            onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
          >
            Next
            <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
