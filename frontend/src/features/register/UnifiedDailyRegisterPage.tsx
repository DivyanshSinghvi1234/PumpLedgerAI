import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Fuel,
  Landmark,
  Lock,
  MessageCircle,
  Plus,
  Trash2,
  TrendingUp,
  Unlock,
} from "lucide-react";

import BankAccountSelect from "@/components/common/BankAccountSelect";
import LoadingState from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import bankAccountService from "@/features/admin/services/bankAccountService";
import dayClosingService from "@/features/day-closing/services/dayClosingService";
import incomeService from "@/features/income/services/incomeService";
import type { IncomeKind, PaymentMode } from "@/features/income/types/income";
import inventoryService from "@/features/inventory/services/inventoryService";
import { pipelineService } from "@/features/pipeline/services/pipelineService";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import { getWhatsAppShareUrl } from "@/lib/whatsapp";

const NOTES = [
  { key: "n500", label: "₹500", value: 500 },
  { key: "n200", label: "₹200", value: 200 },
  { key: "n100", label: "₹100", value: 100 },
  { key: "n50", label: "₹50", value: 50 },
  { key: "n20", label: "₹20", value: 20 },
  { key: "n10", label: "₹10", value: 10 },
] as const;

type NoteKey = (typeof NOTES)[number]["key"];

export default function UnifiedDailyRegisterPage() {
  const queryClient = useQueryClient();
  const { user, activePump, hasRole } = useCurrentUser();
  const isAdmin = hasRole("ADMIN");
  const isOperator = user?.role === "OPERATOR";

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const closingInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Nozzle meter input state (keyed by nozzle_uuid)
  const [nozzleEdits, setNozzleEdits] = useState<
    Record<string, { closing: string; testing: string }>
  >({});

  // Optional Tank Dip check
  const [showDips, setShowDips] = useState(false);
  const [tankDips, setTankDips] = useState<Record<string, string>>({});

  // Quick 1-line income/expense form
  const [entryKind, setEntryKind] = useState<IncomeKind>("EXPENSE");
  const [entryDesc, setEntryDesc] = useState("");
  const [entryAmt, setEntryAmt] = useState("");
  const [entryMode, setEntryMode] = useState<PaymentMode>("CASH");
  const [entryBankUuid, setEntryBankUuid] = useState("");

  // Note count + bank deposit
  const [noteCounts, setNoteCounts] = useState<Record<NoteKey, number>>({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
  });
  const [coins, setCoins] = useState(0);
  const [cashToNextDay, setCashToNextDay] = useState("2000");
  const [cashDeposited, setCashDeposited] = useState("0");
  const [settlementBankUuid, setSettlementBankUuid] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const { data: snapshot, isLoading: snapLoading } = useQuery({
    queryKey: ["daily-snapshot", selectedDate],
    queryFn: () => pipelineService.getSnapshot(selectedDate),
    enabled: !isOperator,
  });

  const { data: draft } = useQuery({
    queryKey: ["dayClosingDraft", selectedDate],
    queryFn: () => dayClosingService.getDraft(selectedDate),
    enabled: !isOperator,
  });

  const { data: bulkForm } = useQuery({
    queryKey: ["nozzleReadingsBulkForm", selectedDate],
    queryFn: () => inventoryService.getBulkReadingsForm(selectedDate),
    enabled: !isOperator,
  });

  const { data: schedules } = useQuery({
    queryKey: ["priceSchedules"],
    queryFn: () => inventoryService.getPriceSchedules(),
    enabled: !isOperator,
    staleTime: 60_000,
  });

  const { data: dayIncomes } = useQuery({
    queryKey: ["incomes", selectedDate],
    queryFn: () => incomeService.getIncomes({ income_date: selectedDate, page_size: 50 }),
    enabled: !isOperator,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => bankAccountService.getBankAccounts(),
    enabled: !isOperator,
  });

  // Auto-select first bank account for quick deposits & bank expenses
  useEffect(() => {
    if (bankAccounts && bankAccounts.length > 0) {
      if (!settlementBankUuid) setSettlementBankUuid(bankAccounts[0].uuid);
      if (!entryBankUuid) setEntryBankUuid(bankAccounts[0].uuid);
    }
  }, [bankAccounts, settlementBankUuid, entryBankUuid]);

  // Seed nozzle inputs from bulkForm
  useEffect(() => {
    if (!bulkForm?.items) return;
    const next: Record<string, { closing: string; testing: string }> = {};
    for (const item of bulkForm.items) {
      next[item.nozzle_uuid] = {
        closing: item.closing_reading != null ? String(item.closing_reading) : "",
        testing: item.testing != null ? String(item.testing) : "0",
      };
    }
    setNozzleEdits(next);
  }, [bulkForm]);

  // Seed tank dips from draft
  useEffect(() => {
    if (!draft?.tank_dips) return;
    const next: Record<string, string> = {};
    let hasAny = false;
    for (const td of draft.tank_dips) {
      if (td.physical_dip != null) {
        next[td.tank_uuid] = String(td.physical_dip);
        hasAny = true;
      } else {
        next[td.tank_uuid] = "";
      }
    }
    setTankDips(next);
    if (hasAny) setShowDips(true);
  }, [draft?.closing_date, draft?.tank_dips]);

  // Seed note counts from snapshot
  useEffect(() => {
    if (!snapshot?.cash_proof?.denominations) return;
    const d = snapshot.cash_proof.denominations;
    setNoteCounts({
      n500: d.notes_500 || 0,
      n200: d.notes_200 || 0,
      n100: d.notes_100 || 0,
      n50: d.notes_50 || 0,
      n20: d.notes_20 || 0,
      n10: d.notes_10 || 0,
    });
    setCoins(d.coins || 0);
    if (snapshot.cash_proof.cash_to_next_day > 0) {
      setCashToNextDay(String(snapshot.cash_proof.cash_to_next_day));
    }
  }, [snapshot?.date, snapshot?.cash_proof?.denom_source]);

  const activeRateByFuel = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of draft?.nozzle_lines ?? []) {
      if (line.rate > 0) map[line.fuel_type] = Number(line.rate);
    }
    for (const s of schedules ?? []) {
      if (s.is_applied && !map[s.fuel_type]) {
        map[s.fuel_type] = Number(s.rate);
      }
    }
    return map;
  }, [draft, schedules]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
    queryClient.invalidateQueries({ queryKey: ["dayClosingDraft"] });
    queryClient.invalidateQueries({ queryKey: ["nozzleReadingsBulkForm"] });
    queryClient.invalidateQueries({ queryKey: ["incomes"] });
    queryClient.invalidateQueries({ queryKey: ["tanks"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["liquid-funds-summary"] });
    queryClient.invalidateQueries({ queryKey: ["report-pnl"] });
  };

  const saveReadingsMutation = useMutation({
    mutationFn: async () => {
      if (!bulkForm?.items) return;
      const readings = bulkForm.items
        .map((item) => {
          const edit = nozzleEdits[item.nozzle_uuid];
          const closingNum = Number(edit?.closing);
          if (!edit?.closing || Number.isNaN(closingNum)) return null;
          return {
            nozzle_uuid: item.nozzle_uuid,
            opening_reading: item.opening_reading,
            closing_reading: closingNum,
            testing_liters: Number(edit.testing || 0),
            return_testing_to_storage: true,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (readings.length === 0) {
        throw new Error("Enter at least one closing meter reading first.");
      }
      return inventoryService.postBulkReadings({
        reading_date: selectedDate,
        readings,
      });
    },
    onSuccess: () => {
      toast.success("Meter readings saved — Tank stock & daily sales updated!");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to save readings");
    },
  });

  const addEntryMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(entryAmt);
      if (!entryDesc.trim() || !amt || amt <= 0) {
        throw new Error("Enter description and a positive amount.");
      }
      return incomeService.createIncome({
        kind: entryKind,
        income_date: selectedDate,
        description: entryDesc.trim(),
        amount: amt,
        category: entryKind === "EXPENSE" ? "Daily Expense" : "Other Income",
        payment_mode: entryMode,
        bank_account_uuid: entryMode === "BANK" ? entryBankUuid || null : null,
      });
    },
    onSuccess: () => {
      toast.success(`${entryKind === "EXPENSE" ? "Expense" : "Income"} added to register!`);
      setEntryDesc("");
      setEntryAmt("");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Could not save entry");
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (uuid: string) => incomeService.deleteIncome(uuid),
    onSuccess: () => {
      toast.success("Entry removed");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not delete entry");
    },
  });

  const countedCashTotal = useMemo(() => {
    const notesSum = NOTES.reduce((acc, n) => acc + (noteCounts[n.key] || 0) * n.value, 0);
    return Math.round((notesSum + (Number(coins) || 0)) * 100) / 100;
  }, [noteCounts, coins]);

  const parsedTankDips = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(tankDips)) {
      if (v !== "" && !Number.isNaN(Number(v))) {
        out[k] = Number(v);
      }
    }
    return out;
  }, [tankDips]);

  const saveDipsMutation = useMutation({
    mutationFn: async () => {
      const dips = Object.entries(parsedTankDips).map(([tank_uuid, physical_dip]) => ({
        tank_uuid,
        physical_dip,
      }));
      if (dips.length === 0) {
        throw new Error("Enter at least one physical tank dip reading.");
      }
      return dayClosingService.recordDips(selectedDate, dips);
    },
    onSuccess: () => {
      toast.success("Tank dips saved & variance updated!");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to save tank dips");
    },
  });

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      return dayClosingService.closeDay({
        closing_date: selectedDate,
        notes_500: noteCounts.n500,
        notes_200: noteCounts.n200,
        notes_100: noteCounts.n100,
        notes_50: noteCounts.n50,
        notes_20: noteCounts.n20,
        notes_10: noteCounts.n10,
        coins: Number(coins) || 0,
        physical_cash_counted: countedCashTotal,
        cash_to_next_day: Number(cashToNextDay) || 0,
        cash_deposited_to_bank: Number(cashDeposited) || 0,
        settlement_bank_account_uuid: settlementBankUuid || null,
        tank_dips: parsedTankDips,
        auto_balance_cash: true,
        notes: closingNotes.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Day closed! Cash-in-hand, Bank balances & Profit are updated.");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to close day");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!snapshot?.closing_uuid) return;
      return dayClosingService.reopenClosing(snapshot.closing_uuid);
    },
    onSuccess: () => {
      toast.success("Day reopened for editing");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Only Admin can reopen a locked day");
    },
  });

  // Simple operator screen (for attendants without manager access)
  if (isOperator) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-ink">Forecourt Slips</h1>
          <p className="text-sm text-ink-muted mt-1">
            Snap a credit slip or record a quick fuel entry.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            to="/dashboard/slips"
            className="rounded-xl border border-fuel-amber/40 bg-fuel-amber/10 p-5 flex items-center gap-4 hover:bg-fuel-amber/20 transition"
          >
            <Camera className="h-8 w-8 text-fuel-amber shrink-0" />
            <div>
              <div className="font-bold text-ink">Scan or Add Slip</div>
              <div className="text-xs text-ink-muted mt-0.5">
                Upload bill photo with OCR or enter manually
              </div>
            </div>
          </Link>
          <Link
            to="/dashboard/slips?tab=list"
            className="rounded-xl border border-hairline bg-surface-1 p-5 flex items-center gap-4 hover:bg-surface-2 transition"
          >
            <BookOpen className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-ink">View Today&apos;s Slips</div>
              <div className="text-xs text-ink-muted mt-0.5">
                Check slips already recorded today
              </div>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  if (snapLoading && !snapshot) {
    return <LoadingState />;
  }

  const isLocked = Boolean(snapshot?.is_locked);
  const floatTomorrow = Number(cashToNextDay) || 0;
  const bankDepositAmt = Number(cashDeposited) || 0;

  // Live drawer cash calculation reacting instantly as user edits float & bank deposit
  const baseExpectedBeforeFloatAndDeposit =
    (snapshot?.cash_proof?.opening_float ?? 0) +
    (snapshot?.cash_proof?.cash_fuel_sales ?? 0) +
    (snapshot?.cash_proof?.cash_other_income ?? 0) +
    (snapshot?.cash_proof?.cash_payments_received ?? 0) -
    (snapshot?.cash_proof?.cash_expenses ?? 0);

  const liveExpectedCash = Math.round(
    (baseExpectedBeforeFloatAndDeposit -
      (isLocked ? snapshot?.cash_proof?.cash_bank_deposits ?? 0 : bankDepositAmt) -
      floatTomorrow) *
      100
  ) / 100;

  const liveVariance = Math.round((countedCashTotal - liveExpectedCash) * 100) / 100;

  const profit = snapshot?.profit;
  const totalMeterLitersLive = (bulkForm?.items ?? []).reduce((sum, item) => {
    const edit = nozzleEdits[item.nozzle_uuid];
    const closeVal = Number(edit?.closing);
    const testVal = Number(edit?.testing || 0);
    if (!edit?.closing || Number.isNaN(closeVal)) return sum + (item.sales ?? 0);
    const gross =
      closeVal >= item.opening_reading
        ? closeVal - item.opening_reading
        : (item.meter_capacity ?? 999999) - item.opening_reading + closeVal;
    return sum + Math.max(0, gross - testVal);
  }, 0);

  const shiftDate = (deltaDays: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleSendWhatsAppSummary = () => {
    const pumpTitle = activePump?.name || "Petrol Pump";
    const creditTotal = snapshot?.vouchers?.credit_sales ?? 0;
    const digitalTotal =
      (snapshot?.vouchers?.upi_sales ?? 0) + (snapshot?.vouchers?.card_sales ?? 0);
    const expensesTotal = snapshot?.cash_proof?.cash_expenses ?? 0;
    const varianceStr = `${liveVariance >= 0 ? "+" : ""}${formatCurrency(liveVariance)}`;
    const lines = [
      `*${pumpTitle} — 8 PM Daily Closing (${selectedDate})*`,
      `• Fuel Sold: ${(snapshot?.meters?.total_liters ?? totalMeterLitersLive).toFixed(1)} L (${formatCurrency(snapshot?.meters?.gross_meter_sales ?? 0)})`,
      `• Credit Slips: ${formatCurrency(creditTotal)}`,
      `• UPI / Card: ${formatCurrency(digitalTotal)}`,
      `• Cash Expenses: ${formatCurrency(expensesTotal)}`,
      `• Bank Deposit: ${formatCurrency(bankDepositAmt)}`,
      `• Cash in Drawer: ${formatCurrency(countedCashTotal)} (Expected ${formatCurrency(liveExpectedCash)} | ${varianceStr})`,
      `• Net Profit: ${formatCurrency(profit?.net_profit ?? 0)}`,
    ];
    if (isLocked) {
      lines.push(`Status: CLOSED & LOCKED`);
    }
    const url = getWhatsAppShareUrl(null, lines.join("\n"));
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-ink">Daily Register</h1>
            {isLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                <Lock className="h-3 w-3" /> Closed &amp; Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                Open Day
              </span>
            )}
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            Enter meter readings, expenses &amp; cash notes once — inventory, customer dues, bank &amp; profit update automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDate(-1)}>
            Prev Day
          </Button>
          <div className="relative flex items-center">
            <Calendar className="h-3.5 w-3.5 text-ink-muted absolute left-2.5 pointer-events-none" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-8 h-8 w-40 text-xs"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => shiftDate(1)}>
            Next Day
          </Button>
          {isLocked && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reopenMutation.mutate()}
              disabled={reopenMutation.isPending}
              className="border-amber-500/40 text-amber-500"
            >
              <Unlock className="h-3.5 w-3.5 mr-1" /> Reopen
            </Button>
          )}
        </div>
      </div>

      {/* 4 Connected Live KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Fuel Sold Today</span>
            <Fuel className="h-4 w-4 text-fuel-amber" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">
            {formatCurrency(snapshot?.meters?.gross_meter_sales ?? 0)}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">
            {(snapshot?.meters?.total_liters ?? 0).toFixed(1)} Liters (auto-updates tanks)
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Credit + Digital Slips</span>
            <Camera className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">
            {formatCurrency(
              (snapshot?.vouchers?.credit_sales ?? 0) +
                (snapshot?.vouchers?.upi_sales ?? 0) +
                (snapshot?.vouchers?.card_sales ?? 0)
            )}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">
            Credit {formatCurrency(snapshot?.vouchers?.credit_sales ?? 0)} · UPI/Card{" "}
            {formatCurrency(
              (snapshot?.vouchers?.upi_sales ?? 0) + (snapshot?.vouchers?.card_sales ?? 0)
            )}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Expected Drawer Cash</span>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-ink mt-1">
            {formatCurrency(liveExpectedCash)}
          </div>
          <div
            className={`text-xs mt-0.5 font-medium ${
              Math.abs(liveVariance) <= 10
                ? "text-emerald-500"
                : liveVariance < 0
                ? "text-rose-500"
                : "text-amber-500"
            }`}
          >
            Counted {formatCurrency(countedCashTotal)} ({liveVariance >= 0 ? "+" : ""}
            {formatCurrency(liveVariance)})
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-4">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Today&apos;s Net Profit</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div
            className={`text-xl font-bold mt-1 ${
              (profit?.net_profit ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {formatCurrency(profit?.net_profit ?? 0)}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">
            {profit?.margin_source === "UNCONFIGURED" ? (
              <Link to="/dashboard/money?tab=profit" className="text-fuel-amber underline">
                Set ₹/L commission to calculate profit →
              </Link>
            ) : (
              <>
                Margin {formatCurrency(profit?.fuel_gross_margin ?? 0)} − Exp{" "}
                {formatCurrency(profit?.total_expenses ?? 0)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* STEP 1: Fuel Sold (Nozzle Meter Readings) */}
      <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink">1. Fuel Sold (Meter Readings)</h2>
            <p className="text-xs text-ink-muted">
              Opening carries over automatically. Type closing reading &amp; press <kbd className="rounded border border-hairline px-1 py-0.5 text-[10px]">Enter</kbd> to jump to next nozzle.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted">
              Live Total: <strong className="text-ink">{totalMeterLitersLive.toFixed(1)} L</strong>
            </span>
            <Button
              size="sm"
              onClick={() => saveReadingsMutation.mutate()}
              disabled={isLocked || saveReadingsMutation.isPending || !bulkForm?.items?.length}
            >
              {saveReadingsMutation.isPending ? "Saving..." : "Save Readings"}
            </Button>
          </div>
        </div>

        {!bulkForm?.items?.length ? (
          <div className="rounded-lg border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
            No nozzles configured yet.{" "}
            <Link to="/dashboard/inventory" className="text-fuel-amber font-semibold underline">
              Add a tank &amp; nozzle in Inventory →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-ink-muted">
                  <th className="py-2 pr-3">Nozzle</th>
                  <th className="py-2 px-2">Fuel</th>
                  <th className="py-2 px-2 text-right">Opening</th>
                  <th className="py-2 px-2">Closing Reading</th>
                  <th className="py-2 px-2">Testing (L)</th>
                  <th className="py-2 px-2 text-right">Sold (L)</th>
                  <th className="py-2 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bulkForm.items.map((item, idx) => {
                  const edit = nozzleEdits[item.nozzle_uuid] ?? { closing: "", testing: "0" };
                  const closeVal = Number(edit.closing);
                  const testVal = Number(edit.testing || 0);
                  const hasClose = edit.closing !== "" && !Number.isNaN(closeVal);
                  const gross = hasClose
                    ? closeVal >= item.opening_reading
                      ? closeVal - item.opening_reading
                      : (item.meter_capacity ?? 999999) - item.opening_reading + closeVal
                    : 0;
                  const soldL = hasClose ? Math.max(0, gross - testVal) : 0;
                  const rate = activeRateByFuel[item.fuel_type] ?? 0;
                  const amt = soldL * rate;

                  return (
                    <tr key={item.nozzle_uuid} className="border-b border-hairline/50">
                      <td className="py-2 pr-3 font-medium text-ink">
                        {item.nozzle_name}
                        <span className="block text-[11px] text-ink-muted">{item.dispenser_name}</span>
                      </td>
                      <td className="py-2 px-2 text-xs font-semibold text-ink-muted">
                        {item.fuel_type}
                        {rate > 0 && <span className="block text-[10px]">₹{rate}/L</span>}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-xs text-ink-muted">
                        {item.opening_reading.toFixed(2)}
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          ref={(el) => {
                            closingInputRefs.current[idx] = el;
                          }}
                          type="number"
                          step="0.01"
                          disabled={isLocked}
                          placeholder="Closing..."
                          value={edit.closing}
                          onChange={(e) =>
                            setNozzleEdits((prev) => ({
                              ...prev,
                              [item.nozzle_uuid]: { ...edit, closing: e.target.value },
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            const nextInput = closingInputRefs.current[idx + 1];
                            if (nextInput) {
                              nextInput.focus();
                              nextInput.select();
                            } else if (!isLocked && !saveReadingsMutation.isPending) {
                              saveReadingsMutation.mutate();
                            }
                          }}
                          className="h-8 w-36 font-mono text-sm"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          disabled={isLocked}
                          value={edit.testing}
                          onChange={(e) =>
                            setNozzleEdits((prev) => ({
                              ...prev,
                              [item.nozzle_uuid]: { ...edit, testing: e.target.value },
                            }))
                          }
                          className="h-8 w-20 font-mono text-xs"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-ink">
                        {soldL.toFixed(1)}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-semibold text-emerald-500">
                        {formatCurrency(amt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Collapsible Optional Tank Dip Check */}
        {(draft?.tank_dips?.length ?? 0) > 0 && (
          <div className="border-t border-hairline/60 pt-3">
            <button
              type="button"
              onClick={() => setShowDips((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer"
            >
              {showDips ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Tank Dip Check (Optional — catch underground fuel shortage)
            </button>

            {showDips && (
              <div className="mt-3 space-y-3 rounded-lg bg-surface-2/40 border border-hairline p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {draft!.tank_dips.map((td) => {
                    const dipStr = tankDips[td.tank_uuid] ?? "";
                    const dipNum = Number(dipStr);
                    const hasDip = dipStr !== "" && !Number.isNaN(dipNum);
                    const varL = hasDip
                      ? Math.round((dipNum - td.book_stock) * 10) / 10
                      : td.variance_liters;

                    return (
                      <div key={td.tank_uuid} className="rounded-md border border-hairline bg-surface-1 p-2.5 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between font-semibold text-ink">
                          <span>{td.tank_name} ({td.fuel_type})</span>
                          <span className="text-ink-muted font-mono">
                            Book: {td.book_stock.toFixed(0)} L
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="1"
                            disabled={isLocked}
                            placeholder="Physical dip (L)"
                            value={dipStr}
                            onChange={(e) =>
                              setTankDips((prev) => ({ ...prev, [td.tank_uuid]: e.target.value }))
                            }
                            className="h-8 font-mono text-xs"
                          />
                          {varL != null && (
                            <span
                              className={`font-mono font-semibold whitespace-nowrap ${
                                varL < -50 ? "text-rose-500" : "text-emerald-500"
                              }`}
                            >
                              {varL >= 0 ? "+" : ""}
                              {varL.toFixed(0)} L
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {!isLocked && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={saveDipsMutation.isPending}
                      onClick={() => saveDipsMutation.mutate()}
                    >
                      {saveDipsMutation.isPending ? "Saving Dips..." : "Save Dips"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STEP 2: Slips + Money Received / Spent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Auto-pulled OCR Slips & Collections */}
        <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink">2A. Today&apos;s Slips &amp; Collections</h2>
              <p className="text-xs text-ink-muted">
                Pulled automatically from scanned OCR slips &amp; customer payments.
              </p>
            </div>
            <Link to="/dashboard/slips">
              <Button size="sm" variant="outline">
                <Camera className="h-3.5 w-3.5 mr-1.5" /> Scan / Add Slip
              </Button>
            </Link>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1.5 border-b border-hairline/50">
              <span className="text-ink-muted">Credit Fuel Slips (Udhaar)</span>
              <span className="font-semibold text-ink">
                {formatCurrency(snapshot?.vouchers?.credit_sales ?? 0)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-hairline/50">
              <span className="text-ink-muted">UPI + Card Slips</span>
              <span className="font-semibold text-ink">
                {formatCurrency(
                  (snapshot?.vouchers?.upi_sales ?? 0) + (snapshot?.vouchers?.card_sales ?? 0)
                )}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-hairline/50">
              <span className="text-ink-muted">Walk-in Cash Fuel (Unbilled Meter Gap)</span>
              <span className="font-semibold text-emerald-500">
                {formatCurrency(snapshot?.vouchers?.unbilled_cash_fuel ?? 0)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-hairline/50">
              <span className="text-ink-muted">Customer Due Payments (Cash / Digital)</span>
              <span className="font-semibold text-ink">
                {formatCurrency(
                  (snapshot?.cash_proof?.cash_payments_received ?? 0) +
                    (snapshot?.digital_collections?.credit_payments_digital ?? 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link to="/dashboard/customers" className="text-fuel-amber hover:underline inline-flex items-center gap-1">
              Record customer payment <ArrowRight className="h-3 w-3" />
            </Link>
            <Link to="/dashboard/slips?tab=list" className="text-ink-muted hover:text-ink">
              View all slips →
            </Link>
          </div>
        </div>

        {/* 1-Line Quick Expense / Income */}
        <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-ink">2B. Money Spent / Other Income</h2>
            <p className="text-xs text-ink-muted">
              Tea, diesel, generator, lube sale — automatically updates Cash or Bank &amp; Net Profit.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
            <select
              disabled={isLocked}
              value={entryKind}
              onChange={(e) => setEntryKind(e.target.value as IncomeKind)}
              className="sm:col-span-3 h-9 rounded-md border border-hairline bg-canvas px-2 text-xs font-semibold text-ink"
            >
              <option value="EXPENSE">Expense (-)</option>
              <option value="INCOME">Income (+)</option>
            </select>
            <Input
              disabled={isLocked}
              placeholder="What for? (e.g. Tea, Repair)"
              value={entryDesc}
              onChange={(e) => setEntryDesc(e.target.value)}
              className="sm:col-span-5 h-9 text-xs"
            />
            <Input
              type="number"
              disabled={isLocked}
              placeholder="₹ Amount"
              value={entryAmt}
              onChange={(e) => setEntryAmt(e.target.value)}
              className="sm:col-span-4 h-9 text-xs"
            />
            <select
              disabled={isLocked}
              value={entryMode}
              onChange={(e) => setEntryMode(e.target.value as PaymentMode)}
              className="sm:col-span-4 h-9 rounded-md border border-hairline bg-canvas px-2 text-xs text-ink"
            >
              <option value="CASH">Cash Drawer</option>
              <option value="BANK">Bank / UPI</option>
            </select>
            {entryMode === "BANK" && (
              <div className="sm:col-span-5">
                <BankAccountSelect
                  value={entryBankUuid}
                  onChange={setEntryBankUuid}
                  label=""
                  autoSelectDefault
                />
              </div>
            )}
            <Button
              size="sm"
              disabled={isLocked || addEntryMutation.isPending}
              onClick={() => addEntryMutation.mutate()}
              className={entryMode === "BANK" ? "sm:col-span-3 h-9" : "sm:col-span-8 h-9"}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add
            </Button>
          </div>

          <div className="max-h-44 overflow-y-auto divide-y divide-hairline/50">
            {!dayIncomes?.items?.length ? (
              <p className="text-xs text-ink-muted py-3 text-center">
                No expenses or other income recorded for {selectedDate}.
              </p>
            ) : (
              dayIncomes.items.map((item) => (
                <div key={item.uuid} className="flex items-center justify-between py-2 text-xs">
                  <div>
                    <span
                      className={`inline-block mr-2 font-bold ${
                        item.kind === "EXPENSE" ? "text-rose-500" : "text-emerald-500"
                      }`}
                    >
                      {item.kind === "EXPENSE" ? "−" : "+"}
                    </span>
                    <span className="font-medium text-ink">{item.description}</span>
                    <span className="ml-2 text-ink-muted">({item.payment_mode})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-ink">
                      {formatCurrency(item.amount)}
                    </span>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => deleteEntryMutation.mutate(item.uuid)}
                        className="text-ink-muted hover:text-rose-500 cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* STEP 3: Cash Count, Bank Deposit & Lock Day */}
      <div className="rounded-xl border border-hairline bg-surface-1 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-ink">3. Cash Count, Bank Deposit &amp; Close Day</h2>
            <p className="text-xs text-ink-muted">
              Count physical notes in drawer. Locking automatically records walk-in cash sales &amp; syncs digital/cash deposits to Bank.
            </p>
          </div>
          {Math.abs(liveVariance) <= 10 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
              <CheckCircle2 className="h-4 w-4" /> Drawer Balanced
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
              <AlertTriangle className="h-4 w-4" /> Cash {liveVariance < 0 ? "Short" : "Excess"}:{" "}
              {formatCurrency(Math.abs(liveVariance))}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {NOTES.map((n) => (
            <div key={n.key} className="space-y-1">
              <Label className="text-xs text-ink-muted">{n.label} Notes</Label>
              <Input
                type="number"
                min={0}
                disabled={isLocked}
                value={noteCounts[n.key]}
                onChange={(e) =>
                  setNoteCounts((prev) => ({
                    ...prev,
                    [n.key]: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="h-9 font-mono text-sm"
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs text-ink-muted">Coins (₹)</Label>
            <Input
              type="number"
              min={0}
              disabled={isLocked}
              value={coins}
              onChange={(e) => setCoins(Math.max(0, Number(e.target.value) || 0))}
              className="h-9 font-mono text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1">
            <Label className="text-xs text-ink-muted">Keep Float for Tomorrow (₹)</Label>
            <Input
              type="number"
              min={0}
              disabled={isLocked}
              value={cashToNextDay}
              onChange={(e) => setCashToNextDay(e.target.value)}
              className="h-9 font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-ink-muted">Cash Deposited to Bank Today (₹)</Label>
            <Input
              type="number"
              min={0}
              disabled={isLocked}
              value={cashDeposited}
              onChange={(e) => setCashDeposited(e.target.value)}
              className="h-9 font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-ink-muted flex items-center gap-1">
              <Landmark className="h-3 w-3" /> Settlement Bank (UPI/Card/Deposit)
            </Label>
            <BankAccountSelect
              value={settlementBankUuid}
              onChange={setSettlementBankUuid}
              label=""
              autoSelectDefault
            />
          </div>
        </div>

        <div className="rounded-lg bg-surface-2/60 border border-hairline p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="space-y-0.5 text-ink-muted">
            <div>
              Opening Float ({formatCurrency(snapshot?.cash_proof?.opening_float ?? 0)}) + Cash Fuel (
              {formatCurrency(snapshot?.cash_proof?.cash_fuel_sales ?? 0)}) + Cash Collections (
              {formatCurrency(
                (snapshot?.cash_proof?.cash_payments_received ?? 0) +
                  (snapshot?.cash_proof?.cash_other_income ?? 0)
              )}
              ) − Expenses ({formatCurrency(snapshot?.cash_proof?.cash_expenses ?? 0)}) − Bank Deposit (
              {formatCurrency(bankDepositAmt)}) − Tomorrow Float ({formatCurrency(floatTomorrow)})
            </div>
            <div className="text-sm font-bold text-ink">
              Expected Cash: {formatCurrency(liveExpectedCash)} · Counted:{" "}
              {formatCurrency(countedCashTotal)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Input
              disabled={isLocked}
              placeholder="Optional note..."
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              className="h-9 w-40 text-xs"
            />
            <Button
              disabled={isLocked || closeDayMutation.isPending}
              onClick={() => closeDayMutation.mutate()}
              className="h-9"
            >
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              {isLocked
                ? "Day Locked"
                : closeDayMutation.isPending
                ? "Closing..."
                : "Save & Lock Day"}
            </Button>
            <Button
              type="button"
              variant={isLocked ? "default" : "outline"}
              onClick={handleSendWhatsAppSummary}
              className={`h-9 ${isLocked ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              Send 8 PM WhatsApp
            </Button>
          </div>
        </div>
      </div>

      {/* Subtle footer links for traditional register print */}
      <div className="flex items-center justify-between text-xs text-ink-muted pt-1">
        <Link to="/dashboard/register-sheet" className="hover:text-ink underline">
          Open printable traditional register sheet →
        </Link>
        <Link to="/dashboard/money" className="hover:text-ink underline">
          View Cash-in-Hand, Bank Balances &amp; Monthly Profit →
        </Link>
      </div>
    </div>
  );
}
