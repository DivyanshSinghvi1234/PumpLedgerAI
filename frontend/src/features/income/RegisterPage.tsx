import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/common/PageHeader";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Fuel,
  Lock,
  MessageCircle,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { pipelineService } from "@/features/pipeline/services/pipelineService";
import { useVoucherList } from "@/features/vouchers/hooks/useVoucherList";
import voucherService from "@/features/vouchers/services/voucherService";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import incomeService from "@/features/income/services/incomeService";
import type { IncomeKind, PaymentMode } from "@/features/income/types/income";
import dayClosingService from "@/features/day-closing/services/dayClosingService";
import bankAccountService from "@/features/admin/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";
import { getWhatsAppShareUrl } from "@/lib/whatsapp";
import api from "@/api/client";

// Cash denominations rendered in the collection-counts grid (note value → state key)
const DENOMINATIONS = [
  { value: 500, key: "n500" },
  { value: 200, key: "n200" },
  { value: 100, key: "n100" },
  { value: 50, key: "n50" },
  { value: 20, key: "n20" },
  { value: 10, key: "n10" },
] as const;

// Indian currency format style for ledger: 15000=00
function formatLedgerAmount(val: number): string {
  const safeVal = Number(val) || 0;
  const base = Math.floor(safeVal);
  const paise = Math.round((safeVal - base) * 100);
  const paiseStr = paise === 0 ? "00" : paise.toString().padStart(2, "0");
  return `${base.toLocaleString("en-IN")}=${paiseStr}`;
}

interface NozzleDraftItem {
  closing: string;
  interim6am: string;
  testing: string;
}

export default function RegisterPage() {
  const { user, activePump, hasRole } = useCurrentUser();
  const isAdmin = hasRole("ADMIN");
  const isOperator = user?.role === "OPERATOR";
  const queryClient = useQueryClient();
  const stationName = activePump?.name || "Shree Petroleum";

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Inline editable nozzle closing readings (persisted to localStorage draft per date)
  const [nozzleDrafts, setNozzleDrafts] = useState<Record<string, NozzleDraftItem>>({});
  const [hasUnsavedReadings, setHasUnsavedReadings] = useState(false);
  const [rateChanged6am, setRateChanged6am] = useState(false);
  const closingInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Quick 1-line Expense / Income panel
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [entryKind, setEntryKind] = useState<IncomeKind>("EXPENSE");
  const [entryDesc, setEntryDesc] = useState("");
  const [entryAmt, setEntryAmt] = useState("");
  const [entryMode, setEntryMode] = useState<PaymentMode>("CASH");
  const [entryBankUuid, setEntryBankUuid] = useState("");

  // Optional Tank Dip Check + Day Closing Bar
  const [showDips, setShowDips] = useState(false);
  const [tankDips, setTankDips] = useState<Record<string, string>>({});
  const [cashToNextDay, setCashToNextDay] = useState("2000");
  const [settlementBankUuid, setSettlementBankUuid] = useState("");

  // Backend-synced state for cash denominations & daily sheet totals (with localStorage fallback)
  const cacheKey = `ledger_denominations_${date}`;
  const nozzleDraftKey = `register_nozzle_draft_${date}`;

  const [notes, setNotes] = useState(() => ({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
  }));
  const [cashHome, setCashHome] = useState(0);
  const [prevDeposit, setPrevDeposit] = useState(0);
  const [ledgerInterest, setLedgerInterest] = useState(0);

  const cashSheetQuery = useQuery({
    queryKey: ["dailyCashSheet", date],
    queryFn: async () => {
      const res = await api.get("/v1/income/cash-sheet", { params: { on_date: date } });
      return res.data;
    },
    enabled: !isOperator,
  });

  useEffect(() => {
    if (cashSheetQuery.data) {
      const d = cashSheetQuery.data;
      setNotes({
        n500: d.notes_500 || 0,
        n200: d.notes_200 || 0,
        n100: d.notes_100 || 0,
        n50: d.notes_50 || 0,
        n20: d.notes_20 || 0,
        n10: d.notes_10 || 0,
      });
      setCashHome(Number(d.cash_sent_home) || 0);
      setPrevDeposit(Number(d.prev_deposit) || 0);
      setLedgerInterest(Number(d.ledger_interest) || 0);
    } else if (cashSheetQuery.isFetched && !cashSheetQuery.data) {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setNotes(parsed.notes || { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 });
          setCashHome(parsed.cashHome ?? 0);
          setPrevDeposit(parsed.prevDeposit ?? 0);
          setLedgerInterest(parsed.ledgerInterest ?? 0);
        } catch (e) {
          console.error("Failed to parse denominations", e);
        }
      } else {
        setNotes({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 });
        setCashHome(0);
        setPrevDeposit(0);
        setLedgerInterest(0);
      }
    }
  }, [cashSheetQuery.data, cashSheetQuery.isFetched, cacheKey]);

  // Save cache helper (writes to localStorage + syncs with backend)
  const saveDenominations = (
    updatedNotes: typeof notes,
    updatedHome = cashHome,
    updatedDeposit = prevDeposit,
    updatedInterest = ledgerInterest
  ) => {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        notes: updatedNotes,
        cashHome: updatedHome,
        prevDeposit: updatedDeposit,
        ledgerInterest: updatedInterest,
      })
    );

    api
      .post("/v1/income/cash-sheet", {
        sheet_date: date,
        notes_500: updatedNotes.n500,
        notes_200: updatedNotes.n200,
        notes_100: updatedNotes.n100,
        notes_50: updatedNotes.n50,
        notes_20: updatedNotes.n20,
        notes_10: updatedNotes.n10,
        cash_sent_home: updatedHome,
        prev_deposit: updatedDeposit,
        ledger_interest: updatedInterest,
      })
      .catch((err) => {
        console.error("Failed to sync cash sheet to backend:", err);
      });
  };

  // Queries for Vouchers, Nozzles, Incomes/Expenses, Payments, Day Closing Draft & Pipeline Snapshot
  const { data: vouchersData, refetch: refetchVouchers } = useVoucherList({
    from_date: date,
    to_date: date,
  });

  const { data: nozzleData, refetch: refetchNozzles } = useQuery({
    queryKey: ["nozzleReadingsBulkForm", date],
    queryFn: () => inventoryService.getBulkReadingsForm(date),
    enabled: !isOperator,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ["registerPayments", date],
    queryFn: () => paymentService.getPayments({ payment_date: date, page_size: 100 }),
    enabled: !isOperator,
  });

  const { data: incomesData } = useQuery({
    queryKey: ["incomes", date],
    queryFn: () => incomeService.getIncomes({ income_date: date, page_size: 50 }),
    enabled: !isOperator,
  });

  const { data: pipelineSnapshot, refetch: refetchSnapshot } = useQuery({
    queryKey: ["daily-snapshot", date],
    queryFn: () => pipelineService.getSnapshot(date),
    enabled: !isOperator,
  });

  const { data: closingDraft } = useQuery({
    queryKey: ["dayClosingDraft", date],
    queryFn: () => dayClosingService.getDraft(date),
    enabled: !isOperator,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => bankAccountService.getBankAccounts(),
    enabled: !isOperator,
  });

  useEffect(() => {
    if (bankAccounts && bankAccounts.length > 0) {
      if (!settlementBankUuid) setSettlementBankUuid(bankAccounts[0].uuid);
      if (!entryBankUuid) setEntryBankUuid(bankAccounts[0].uuid);
    }
  }, [bankAccounts, settlementBankUuid, entryBankUuid]);

  // Seed editable nozzle drafts from API + localStorage unsaved draft
  useEffect(() => {
    if (!nozzleData?.items) return;
    let savedDraft: Record<string, NozzleDraftItem> = {};
    let hadSavedDraft = false;
    try {
      const raw = localStorage.getItem(nozzleDraftKey);
      if (raw) {
        savedDraft = JSON.parse(raw);
        hadSavedDraft = Object.keys(savedDraft).length > 0;
      }
    } catch {
      // ignore storage errors
    }

    const next: Record<string, NozzleDraftItem> = {};
    let has6am = false;
    for (const item of nozzleData.items) {
      const local = savedDraft[item.nozzle_uuid];
      const interimVal =
        local?.interim6am ??
        (item.interim_6am_reading != null ? String(item.interim_6am_reading) : "");
      if (interimVal) has6am = true;
      next[item.nozzle_uuid] = {
        closing:
          local?.closing ??
          (item.closing_reading != null ? String(item.closing_reading) : ""),
        interim6am: interimVal,
        testing: local?.testing ?? (item.testing != null ? String(item.testing) : "0"),
      };
    }
    setNozzleDrafts(next);
    setHasUnsavedReadings(hadSavedDraft);
    if (has6am) setRateChanged6am(true);
  }, [nozzleData, nozzleDraftKey]);

  // Seed tank dips from Day Closing draft
  useEffect(() => {
    if (!closingDraft?.tank_dips) return;
    const next: Record<string, string> = {};
    let hasAny = false;
    for (const td of closingDraft.tank_dips) {
      if (td.physical_dip != null) {
        next[td.tank_uuid] = String(td.physical_dip);
        hasAny = true;
      } else {
        next[td.tank_uuid] = "";
      }
    }
    setTankDips(next);
    if (hasAny) setShowDips(true);
  }, [closingDraft?.closing_date, closingDraft?.tank_dips]);

  useEffect(() => {
    if (pipelineSnapshot?.cash_proof?.cash_to_next_day && pipelineSnapshot.cash_proof.cash_to_next_day > 0) {
      setCashToNextDay(String(pipelineSnapshot.cash_proof.cash_to_next_day));
    }
  }, [pipelineSnapshot?.date, pipelineSnapshot?.cash_proof?.cash_to_next_day]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["daily-snapshot"] });
    queryClient.invalidateQueries({ queryKey: ["dayClosingDraft"] });
    queryClient.invalidateQueries({ queryKey: ["nozzleReadingsBulkForm"] });
    queryClient.invalidateQueries({ queryKey: ["incomes"] });
    queryClient.invalidateQueries({ queryKey: ["tanks"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["liquid-funds-summary"] });
    queryClient.invalidateQueries({ queryKey: ["report-pnl"] });
    queryClient.invalidateQueries({ queryKey: ["vouchers"] });
  };

  const updateNozzleDraft = (nozzleUuid: string, patch: Partial<NozzleDraftItem>) => {
    setNozzleDrafts((prev) => {
      const current = prev[nozzleUuid] ?? { closing: "", interim6am: "", testing: "0" };
      const updated = { ...prev, [nozzleUuid]: { ...current, ...patch } };
      try {
        localStorage.setItem(nozzleDraftKey, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
    setHasUnsavedReadings(true);
  };

  const saveReadingsMutation = useMutation({
    mutationFn: async () => {
      if (!nozzleData?.items) return;
      const readings = nozzleData.items
        .map((item) => {
          const d = nozzleDrafts[item.nozzle_uuid];
          const closingNum = Number(d?.closing);
          if (!d?.closing || Number.isNaN(closingNum)) return null;
          const interimNum =
            rateChanged6am && d.interim6am !== "" && !Number.isNaN(Number(d.interim6am))
              ? Number(d.interim6am)
              : null;
          return {
            nozzle_uuid: item.nozzle_uuid,
            opening_reading: Number(item.opening_reading) || 0,
            closing_reading: closingNum,
            interim_6am_reading: interimNum,
            testing_liters: Number(d.testing || 0),
            return_testing_to_storage: true,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (readings.length === 0) {
        throw new Error("Enter at least one nozzle closing reading first.");
      }
      return inventoryService.postBulkReadings({
        reading_date: date,
        readings,
      });
    },
    onSuccess: () => {
      try {
        localStorage.removeItem(nozzleDraftKey);
      } catch {
        // ignore
      }
      setHasUnsavedReadings(false);
      toast.success("Meter readings saved — Tank inventory & daily profit updated!");
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
        throw new Error("Enter a description and positive amount.");
      }
      return incomeService.createIncome({
        kind: entryKind,
        income_date: date,
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
      toast.success("Entry deleted");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not delete entry");
    },
  });

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
      return dayClosingService.recordDips(date, dips);
    },
    onSuccess: () => {
      toast.success("Tank dips saved & stock variance updated!");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to save tank dips");
    },
  });

  const totalCashCounted = DENOMINATIONS.reduce((sum, d) => sum + notes[d.key] * d.value, 0);

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      return dayClosingService.closeDay({
        closing_date: date,
        notes_500: notes.n500,
        notes_200: notes.n200,
        notes_100: notes.n100,
        notes_50: notes.n50,
        notes_20: notes.n20,
        notes_10: notes.n10,
        coins: 0,
        physical_cash_counted: totalCashCounted,
        cash_to_next_day: Number(cashToNextDay) || 0,
        cash_deposited_to_bank: Number(prevDeposit) || 0,
        settlement_bank_account_uuid: settlementBankUuid || null,
        tank_dips: parsedTankDips,
        auto_balance_cash: true,
      });
    },
    onSuccess: () => {
      toast.success("Day closed! Cash-in-hand, Bank balances & Profit are updated.");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to lock day");
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!pipelineSnapshot?.closing_uuid) return;
      return dayClosingService.reopenClosing(pipelineSnapshot.closing_uuid);
    },
    onSuccess: () => {
      toast.success("Day reopened for editing");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Only Admin can reopen a locked day");
    },
  });

  const handleAutoFillFromShift = () => {
    if (!pipelineSnapshot) return;
    if (pipelineSnapshot.is_locked) {
      toast.error("This business day is locked in Day Closing.");
      return;
    }
    const d = pipelineSnapshot.cash_proof.denominations;
    const nextNotes = {
      n500: d.notes_500 || 0,
      n200: d.notes_200 || 0,
      n100: d.notes_100 || 0,
      n50: d.notes_50 || 0,
      n20: d.notes_20 || 0,
      n10: d.notes_10 || 0,
    };
    setNotes(nextNotes);
    saveDenominations(nextNotes);
    toast.success(`Synced note counts (${pipelineSnapshot.cash_proof.denom_source}).`);
  };

  // Fast Monthly Bulk Prefetch
  useEffect(() => {
    if (isOperator) return;
    let isMounted = true;
    const loadMonthData = async () => {
      try {
        const activeMonth = date.substring(0, 7);
        const monthStart = `${activeMonth}-01`;
        const [y, m] = activeMonth.split("-").map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        const monthEnd = `${activeMonth}-${String(lastDay).padStart(2, "0")}`;

        const res = await voucherService.getVouchers({
          from_date: monthStart,
          to_date: monthEnd,
          page_size: 1000,
        });

        if (!isMounted || !res?.items) return;

        const vouchersByDate: Record<string, typeof res.items> = {};
        res.items.forEach((v: any) => {
          const vDate = v.date || v.voucher_date || (v.created_at ? v.created_at.split("T")[0] : "");
          if (vDate) {
            if (!vouchersByDate[vDate]) vouchersByDate[vDate] = [];
            vouchersByDate[vDate].push(v);
          }
        });

        for (let d = 1; d <= lastDay; d++) {
          const dayStr = `${activeMonth}-${String(d).padStart(2, "0")}`;
          const dayItems = vouchersByDate[dayStr] || [];
          queryClient.setQueryData(
            ["vouchers", { from_date: dayStr, to_date: dayStr }],
            {
              items: dayItems,
              total: dayItems.length,
              page: 1,
              page_size: 50,
              pages: 1,
            }
          );
        }
      } catch (err) {
        console.error("Month prefetch error:", err);
      }
    };

    loadMonthData();
    return () => {
      isMounted = false;
    };
  }, [date.substring(0, 7), queryClient, isOperator]);

  // Drag-pan container state
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a")
    ) {
      return;
    }
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    if (containerRef.current) {
      startScrollLeftRef.current = containerRef.current.scrollLeft;
    }
    const mainEl = containerRef.current?.closest("main") || document.documentElement;
    if (mainEl) {
      startScrollTopRef.current = mainEl.scrollTop;
    }
    setIsGrabbing(true);
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      if (containerRef.current) {
        containerRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
      }
      const mainEl = containerRef.current?.closest("main") || document.documentElement;
      if (mainEl) {
        mainEl.scrollTop = startScrollTopRef.current - deltaY;
      }
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsGrabbing(false);
      }
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Fetch active fuel price schedules
  const priceSchedulesQuery = useQuery({
    queryKey: ["priceSchedules"],
    queryFn: () => inventoryService.getPriceSchedules(),
    enabled: !isOperator,
  });

  // Simple Operator screen (for attendants without manager access)
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

  const isLocked = Boolean(pipelineSnapshot?.is_locked);
  const dateObject = new Date(date);
  const formattedDateHeader = dateObject
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, "-");

  const cashPaymentsForDate = (paymentsData?.items ?? [])
    .map((p) => {
      const cashPart =
        p.payment_mode === "CASH"
          ? Number(p.amount ?? 0)
          : p.payment_mode === "SPLIT"
          ? Number(p.cash_amount ?? 0)
          : 0;
      return {
        uuid: p.uuid,
        customer_name: p.customer_name,
        amount: cashPart,
      };
    })
    .filter((p) => p.amount > 0);

  const totalCashPayments = cashPaymentsForDate.reduce((sum, p) => sum + p.amount, 0);

  // Real expenses & other income from backend Income table
  const realExpenses = (incomesData?.items ?? [])
    .filter((item) => item.kind === "EXPENSE")
    .map((item) => ({
      uuid: item.uuid,
      customer_name: `${item.description} (${item.payment_mode})`,
      amount: Number(item.amount ?? 0),
    }));

  const realCashOtherIncomes = (incomesData?.items ?? [])
    .filter((item) => item.kind === "INCOME" && item.payment_mode === "CASH")
    .map((item) => ({
      uuid: item.uuid,
      customer_name: `${item.description} [CASH]`,
      amount: Number(item.amount ?? 0),
    }));

  const totalExpensesAmount = realExpenses.reduce((s, e) => s + e.amount, 0);

  // Map vouchers
  const activeVouchers = vouchersData?.items?.length
    ? vouchersData.items.map((v) => ({
        quantity_liters: Number(v.quantity_liters ?? 0),
        customer_name:
          (v.customer_name || "Cash Customer") +
          (v.vehicle_number ? ` (${v.vehicle_number})` : "") +
          (v.payment_mode ? ` [${v.payment_mode}]` : ""),
        amount: Number(v.total_amount ?? 0),
      }))
    : [];

  const totalVouchersAmount = activeVouchers.reduce((sum, item) => sum + item.amount, 0);

  const paymentRank = (name: string) =>
    /\[CREDIT\]/i.test(name) ? 0 : /\[UPI\]/i.test(name) ? 1 : /\[CARD\]/i.test(name) ? 2 : 3;
  const sortedVouchers = [...activeVouchers].sort(
    (a, b) => paymentRank(a.customer_name) - paymentRank(b.customer_name)
  );

  // Multi-sheet pagination per date (14 rows fit per ledger sheet)
  const ROWS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil((sortedVouchers.length + realExpenses.length) / ROWS_PER_PAGE));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleVouchers = sortedVouchers.slice(
    currentPageIndex * ROWS_PER_PAGE,
    (currentPageIndex + 1) * ROWS_PER_PAGE
  );

  function triggerPageTurn(dir: "next" | "prev") {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipDirection(dir);

    setTimeout(() => {
      if (dir === "next") {
        if (currentPageIndex < totalPages - 1) {
          setPageIndex(currentPageIndex + 1);
        } else {
          const [y, m, dayVal] = date.split("-").map(Number);
          const d = new Date(y, m - 1, dayVal + 1);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          setDate(`${yyyy}-${mm}-${dd}`);
          setPageIndex(0);
        }
      } else {
        if (currentPageIndex > 0) {
          setPageIndex(currentPageIndex - 1);
        } else {
          const [y, m, dayVal] = date.split("-").map(Number);
          const d = new Date(y, m - 1, dayVal - 1);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          setDate(`${yyyy}-${mm}-${dd}`);
          setPageIndex(999);
        }
      }
    }, 350);

    setTimeout(() => {
      setIsFlipping(false);
      setFlipDirection(null);
    }, 700);
  }

  const grandTotalLeft =
    totalCashCounted + totalVouchersAmount + totalExpensesAmount + cashHome + prevDeposit;

  // Map Nozzles using live editable drafts so right-page equations update instantly as you type
  const activeNozzles = nozzleData?.items?.length
    ? nozzleData.items.map((item, idx) => {
        const draftItem = nozzleDrafts[item.nozzle_uuid];
        const closingStr =
          draftItem?.closing ?? (item.closing_reading != null ? String(item.closing_reading) : "");
        const closingNum = closingStr !== "" && !Number.isNaN(Number(closingStr)) ? Number(closingStr) : null;
        const testingNum =
          draftItem?.testing !== undefined
            ? Number(draftItem.testing) || 0
            : Number(item.testing) || 0;
        const interimStr =
          draftItem?.interim6am ??
          (item.interim_6am_reading != null ? String(item.interim_6am_reading) : "");
        return {
          idx,
          nozzle_uuid: item.nozzle_uuid,
          nozzle_name: item.nozzle_name,
          dispenser_name: item.dispenser_name,
          fuel_type: item.fuel_type,
          opening_reading: Number(item.opening_reading) || 0,
          closing_reading: closingNum,
          closing_str: closingStr,
          interim_str: interimStr,
          meter_capacity: Number(item.meter_capacity) || 999999,
          testing: testingNum,
        };
      })
    : [];

  const gridItems = activeNozzles.map((noz) => {
    const hasClosing = noz.closing_reading != null;
    const rawSales = hasClosing
      ? noz.closing_reading! >= noz.opening_reading
        ? noz.closing_reading! - noz.opening_reading
        : noz.meter_capacity - noz.opening_reading + noz.closing_reading!
      : 0;
    const netVol = hasClosing ? Math.max(0, rawSales - noz.testing) : 0;
    const dispenser_name = noz.dispenser_name || (noz.fuel_type === "DIESEL" ? "HSD I" : "MS I");
    return {
      ...noz,
      hasClosing,
      dispenser_name,
      rawSales,
      netVol,
    };
  });

  const groupedDispensers: Record<string, typeof gridItems> = {};
  gridItems.forEach((item) => {
    if (!groupedDispensers[item.dispenser_name]) {
      groupedDispensers[item.dispenser_name] = [];
    }
    groupedDispensers[item.dispenser_name].push(item);
  });

  const normalizeFuelType = (ft: string): "DIESEL" | "PETROL" | "SPEED" => {
    if (!ft) return "PETROL";
    const upper = ft.toUpperCase();
    if (upper.includes("DIESEL") || upper.includes("HSD")) return "DIESEL";
    if (upper.includes("SPEED")) return "SPEED";
    return "PETROL";
  };

  const rawSalesByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };
  const nozzleTestingByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };
  gridItems.forEach((item) => {
    const key = normalizeFuelType(item.fuel_type);
    rawSalesByFuel[key] = (rawSalesByFuel[key] || 0) + item.rawSales;
    nozzleTestingByFuel[key] = (nozzleTestingByFuel[key] || 0) + item.testing;
  });

  const getTankStorageTestingFor = (targetKey: "DIESEL" | "PETROL" | "SPEED"): number => {
    try {
      const perTankSaved = localStorage.getItem("per_tank_testing_map");
      if (perTankSaved) {
        const perTankMap: Record<string, number> = JSON.parse(perTankSaved);
        const cachedTanks: any[] = queryClient.getQueryData(["tanks"]) || [];
        if (cachedTanks.length > 0) {
          let tankSum = 0;
          let foundMatchingTank = false;
          cachedTanks.forEach((tank: any) => {
            if (normalizeFuelType(tank.fuel_type) === targetKey && perTankMap[tank.uuid] !== undefined) {
              tankSum += Number(perTankMap[tank.uuid]) || 0;
              foundMatchingTank = true;
            }
          });
          if (foundMatchingTank) return tankSum;
        }
      }
    } catch {
      // ignore
    }
    return 0;
  };

  const getTestingFor = (targetKey: "DIESEL" | "PETROL" | "SPEED"): number =>
    (nozzleTestingByFuel[targetKey] || 0) + getTankStorageTestingFor(targetKey);

  const hsdSummary = {
    rawQty: rawSalesByFuel["DIESEL"] || 0,
    testing: getTestingFor("DIESEL"),
    netVol: Math.max(0, (rawSalesByFuel["DIESEL"] || 0) - getTestingFor("DIESEL")),
  };
  const msSummary = {
    rawQty: rawSalesByFuel["PETROL"] || 0,
    testing: getTestingFor("PETROL"),
    netVol: Math.max(0, (rawSalesByFuel["PETROL"] || 0) - getTestingFor("PETROL")),
  };
  const speedSummary = {
    rawQty: rawSalesByFuel["SPEED"] || 0,
    testing: getTestingFor("SPEED"),
    netVol: Math.max(0, (rawSalesByFuel["SPEED"] || 0) - getTestingFor("SPEED")),
  };

  const getDynamicFuelRate = (fuelType: "DIESEL" | "PETROL" | "SPEED", fallback: number): number => {
    if (!priceSchedulesQuery.data || priceSchedulesQuery.data.length === 0) return fallback;
    const match = priceSchedulesQuery.data.find(
      (s) => normalizeFuelType(s.fuel_type) === fuelType && s.is_applied
    );
    return match ? Number(match.rate) || fallback : fallback;
  };

  const hsdRate = getDynamicFuelRate("DIESEL", 90.0);
  const msRate = getDynamicFuelRate("PETROL", 96.5);
  const msRate2 = getDynamicFuelRate("SPEED", 103.0);

  const hsdAmt = hsdSummary.netVol * hsdRate;
  const msAmt = msSummary.netVol * msRate;
  const speedAmt = speedSummary.netVol * msRate2;
  const totalCalculatedFuelSales = hsdAmt + msAmt + speedAmt;
  const totalLitersLive = hsdSummary.netVol + msSummary.netVol + speedSummary.netVol;
  const otherCashIncomeTotal = realCashOtherIncomes.reduce((s, r) => s + r.amount, 0);
  const grandTotalRight =
    totalCalculatedFuelSales + ledgerInterest + prevDeposit + totalCashPayments + otherCashIncomeTotal;

  const expectedCash = pipelineSnapshot?.cash_proof?.expected_drawer_cash ?? 0;
  const cashVariance = Math.round((totalCashCounted - expectedCash) * 100) / 100;
  const profit = pipelineSnapshot?.profit;

  const handleSendWhatsAppSummary = () => {
    const creditTotal = pipelineSnapshot?.vouchers?.credit_sales ?? 0;
    const digitalTotal =
      (pipelineSnapshot?.vouchers?.upi_sales ?? 0) +
      (pipelineSnapshot?.vouchers?.card_sales ?? 0);
    const expensesTotal = pipelineSnapshot?.cash_proof?.cash_expenses ?? totalExpensesAmount;
    const varianceStr = `${cashVariance >= 0 ? "+" : ""}${formatCurrency(cashVariance)}`;
    const lines = [
      `*${stationName} — 8 PM Daily Register (${date})*`,
      `• Fuel Sold: ${totalLitersLive.toFixed(1)} L (${formatCurrency(totalCalculatedFuelSales)})`,
      `• Credit Slips: ${formatCurrency(creditTotal)}`,
      `• UPI / Card: ${formatCurrency(digitalTotal)}`,
      `• Expenses: ${formatCurrency(expensesTotal)}`,
      `• Bank Deposit: ${formatCurrency(prevDeposit)}`,
      `• Cash Counted: ${formatCurrency(totalCashCounted)} (Expected ${formatCurrency(expectedCash)} | ${varianceStr})`,
      `• Net Profit: ${formatCurrency(profit?.net_profit ?? 0)}`,
    ];
    if (isLocked) lines.push("Status: CLOSED & LOCKED");
    window.open(getWhatsAppShareUrl(null, lines.join("\n")), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4 print-container">
      {/* Action bar (Hidden on prints) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3">
          <PageHeader
            title="Daily Register"
            description="Edit readings & cash counts right inside the register — tanks, customers, bank & profit update automatically."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              refetchVouchers();
              refetchNozzles();
              refetchSnapshot();
            }}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-hairline bg-surface-2 text-ink hover:bg-surface-3 transition cursor-pointer"
            title="Reload Data"
          >
            <RefreshCw size={14} />
          </button>

          <div className="flex bg-surface-2 border border-hairline p-1 rounded-xl">
            <button
              type="button"
              onClick={() => triggerPageTurn("prev")}
              disabled={isFlipping}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3 text-ink transition disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={15} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPageIndex(0);
              }}
              className="bg-transparent text-xs font-mono font-bold text-ink outline-none px-2 text-center border-none focus:ring-0 w-28 cursor-pointer"
            />
            <button
              type="button"
              onClick={() => triggerPageTurn("next")}
              disabled={isFlipping}
              className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3 text-ink transition disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <Button
            size="sm"
            disabled={isLocked || saveReadingsMutation.isPending || activeNozzles.length === 0}
            onClick={() => saveReadingsMutation.mutate()}
            variant={hasUnsavedReadings ? "default" : "outline"}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saveReadingsMutation.isPending
              ? "Saving..."
              : hasUnsavedReadings
              ? "Save Readings *"
              : "Save Readings"}
          </Button>

          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer size={14} className="mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* 4 Live Connected KPIs + Lock Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 no-print">
        <div className="rounded-xl border border-hairline bg-surface-1 p-3.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Fuel Sold (Meters)</span>
            <Fuel className="h-3.5 w-3.5 text-fuel-amber" />
          </div>
          <div className="text-lg font-bold text-ink mt-0.5">
            {formatCurrency(totalCalculatedFuelSales)}
          </div>
          <div className="text-[11px] text-ink-muted">
            {totalLitersLive.toFixed(1)} L (auto-updates tanks)
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-3.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Credit + UPI / Card</span>
            <Link to="/dashboard/slips" className="text-fuel-amber hover:underline font-semibold">
              + Scan Slip
            </Link>
          </div>
          <div className="text-lg font-bold text-ink mt-0.5">
            {formatCurrency(
              (pipelineSnapshot?.vouchers?.credit_sales ?? 0) +
                (pipelineSnapshot?.vouchers?.upi_sales ?? 0) +
                (pipelineSnapshot?.vouchers?.card_sales ?? 0)
            )}
          </div>
          <div className="text-[11px] text-ink-muted">
            Credit {formatCurrency(pipelineSnapshot?.vouchers?.credit_sales ?? 0)} · Digital{" "}
            {formatCurrency(
              (pipelineSnapshot?.vouchers?.upi_sales ?? 0) +
                (pipelineSnapshot?.vouchers?.card_sales ?? 0)
            )}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-3.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Drawer Cash vs Expected</span>
            {isLocked ? (
              <span className="text-emerald-500 font-semibold inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : (
              <span className="text-amber-500 font-semibold">Open Day</span>
            )}
          </div>
          <div className="text-lg font-bold text-ink mt-0.5">
            {formatCurrency(totalCashCounted)}
          </div>
          <div
            className={`text-[11px] font-medium ${
              Math.abs(cashVariance) <= 10
                ? "text-emerald-500"
                : cashVariance < 0
                ? "text-rose-500"
                : "text-amber-500"
            }`}
          >
            Expected {formatCurrency(expectedCash)} ({cashVariance >= 0 ? "+" : ""}
            {formatCurrency(cashVariance)})
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-1 p-3.5">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Today&apos;s Net Profit</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div
            className={`text-lg font-bold mt-0.5 ${
              (profit?.net_profit ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {formatCurrency(profit?.net_profit ?? 0)}
          </div>
          <div className="text-[11px] text-ink-muted">
            {profit?.margin_source === "UNCONFIGURED" ? (
              <Link to="/dashboard/money?tab=profit" className="text-fuel-amber underline">
                Set ₹/L commission →
              </Link>
            ) : (
              <>
                Margin {formatCurrency(profit?.fuel_gross_margin ?? 0)} − Exp{" "}
                {formatCurrency(profit?.total_expenses ?? totalExpensesAmount)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compact Action Strip: Add Expense/Income, 6 AM Split, Tank Dip, Close & Lock + WhatsApp */}
      <div className="rounded-xl border border-hairline bg-surface-1 p-3 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={showQuickEntry ? "default" : "outline"}
              disabled={isLocked}
              onClick={() => setShowQuickEntry((p) => !p)}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Expense / Income
            </Button>

            <label className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border border-hairline bg-surface-2 cursor-pointer text-xs text-ink-muted hover:text-ink">
              <input
                type="checkbox"
                checked={rateChanged6am}
                disabled={isLocked}
                onChange={(e) => setRateChanged6am(e.target.checked)}
                className="accent-fuel-amber"
              />
              6 AM Rate Change?
            </label>

            {(closingDraft?.tank_dips?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => setShowDips((p) => !p)}
                className="inline-flex items-center gap-1 px-2.5 h-8 rounded-md border border-hairline bg-surface-2 text-xs text-ink-muted hover:text-ink cursor-pointer"
              >
                {showDips ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Tank Dip (Optional)
              </button>
            )}

            <button
              type="button"
              disabled={isLocked}
              onClick={handleAutoFillFromShift}
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-md border border-fuel-amber/30 bg-fuel-amber/10 text-xs font-semibold text-fuel-amber hover:bg-fuel-amber/20 cursor-pointer disabled:opacity-40"
            >
              <Sparkles size={12} /> Sync 8 PM Shift Notes
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-muted">Float:</span>
              <Input
                type="number"
                min={0}
                disabled={isLocked}
                value={cashToNextDay}
                onChange={(e) => setCashToNextDay(e.target.value)}
                className="h-8 w-20 font-mono text-xs"
              />
            </div>
            <div className="w-44">
              <BankAccountSelect
                value={settlementBankUuid}
                onChange={setSettlementBankUuid}
                label=""
                autoSelectDefault
              />
            </div>
            {isLocked && isAdmin ? (
              <Button
                size="sm"
                variant="outline"
                disabled={reopenMutation.isPending}
                onClick={() => reopenMutation.mutate()}
                className="h-8 border-amber-500/40 text-amber-500"
              >
                <Unlock className="h-3.5 w-3.5 mr-1" /> Reopen
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isLocked || closeDayMutation.isPending}
                onClick={() => closeDayMutation.mutate()}
                className="h-8"
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                {isLocked ? "Day Locked" : closeDayMutation.isPending ? "Locking..." : "Save & Lock Day"}
              </Button>
            )}
            <Button
              size="sm"
              type="button"
              variant={isLocked ? "default" : "outline"}
              onClick={handleSendWhatsAppSummary}
              className={`h-8 ${isLocked ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Send 8 PM WhatsApp
            </Button>
          </div>
        </div>

        {/* Inline 1-Line Expense / Income Bar */}
        {showQuickEntry && !isLocked && (
          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 pt-2 border-t border-hairline">
            <select
              value={entryKind}
              onChange={(e) => setEntryKind(e.target.value as IncomeKind)}
              className="sm:col-span-2 h-8 rounded-md border border-hairline bg-canvas px-2 text-xs font-semibold text-ink"
            >
              <option value="EXPENSE">Expense (-)</option>
              <option value="INCOME">Income (+)</option>
            </select>
            <Input
              placeholder="Description (e.g. Tea, Repair, Lube)"
              value={entryDesc}
              onChange={(e) => setEntryDesc(e.target.value)}
              className="sm:col-span-4 h-8 text-xs"
            />
            <Input
              type="number"
              placeholder="₹ Amount"
              value={entryAmt}
              onChange={(e) => setEntryAmt(e.target.value)}
              className="sm:col-span-2 h-8 text-xs"
            />
            <select
              value={entryMode}
              onChange={(e) => setEntryMode(e.target.value as PaymentMode)}
              className="sm:col-span-2 h-8 rounded-md border border-hairline bg-canvas px-2 text-xs text-ink"
            >
              <option value="CASH">Cash Drawer</option>
              <option value="BANK">Bank / UPI</option>
            </select>
            {entryMode === "BANK" && (
              <div className="sm:col-span-2">
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
              disabled={addEntryMutation.isPending}
              onClick={() => addEntryMutation.mutate()}
              className={entryMode === "BANK" ? "sm:col-span-12 sm:w-28 h-8" : "sm:col-span-2 h-8"}
            >
              Add to Register
            </Button>
          </div>
        )}

        {/* Inline Optional Tank Dip Check */}
        {showDips && (closingDraft?.tank_dips?.length ?? 0) > 0 && (
          <div className="pt-2 border-t border-hairline grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2 items-center">
            {closingDraft!.tank_dips.map((td) => {
              const dipStr = tankDips[td.tank_uuid] ?? "";
              const dipNum = Number(dipStr);
              const hasDip = dipStr !== "" && !Number.isNaN(dipNum);
              const varL = hasDip
                ? Math.round((dipNum - Number(td.book_stock ?? 0)) * 10) / 10
                : td.variance_liters;
              return (
                <div key={td.tank_uuid} className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink truncate">{td.tank_name}</div>
                    <div className="text-[10px] text-ink-muted font-mono">
                      Book: {Number(td.book_stock ?? 0).toFixed(0)} L
                      {varL != null && (
                        <span className={`ml-1.5 font-bold ${varL < -50 ? "text-rose-500" : "text-emerald-500"}`}>
                          ({varL >= 0 ? "+" : ""}{Number(varL).toFixed(0)} L)
                        </span>
                      )}
                    </div>
                  </div>
                  <Input
                    type="number"
                    disabled={isLocked}
                    placeholder="Dip L"
                    value={dipStr}
                    onChange={(e) => setTankDips((p) => ({ ...p, [td.tank_uuid]: e.target.value }))}
                    className="h-7 w-20 font-mono text-xs"
                  />
                </div>
              );
            })}
            {!isLocked && (
              <Button
                size="sm"
                variant="outline"
                disabled={saveDipsMutation.isPending}
                onClick={() => saveDipsMutation.mutate()}
                className="h-8 w-fit"
              >
                {saveDipsMutation.isPending ? "Saving..." : "Save Dips"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Real bound book container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={`pl-register-container overflow-x-auto min-w-[768px] ${
          isGrabbing ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        {/* Book Outer Spine layout */}
        <div className="pl-book-shell relative min-w-[1000px] w-full max-w-[1250px] mx-auto min-h-[820px] rounded-2xl overflow-hidden border border-amber-950/30 touch-pan-y">
          {/* Left Stacked Page Edges */}
          <div
            onClick={() => triggerPageTurn("prev")}
            className="absolute left-0 top-0 bottom-0 w-[48px] z-40 cursor-pointer group hover:bg-black/[0.03] transition-all duration-300 flex items-center justify-start pl-3 no-print"
            title="Click to turn to previous day"
          >
            <div className="absolute left-0 inset-y-0 w-[12px] flex pointer-events-none">
              <div className="w-[3px] h-full bg-[#e7dcc2] border-r border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#efe6d0] border-r border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#faf6ee] border-r border-[#c4b391]/30" />
            </div>
            <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 bg-white/90 p-2.5 rounded-full shadow-lg border border-[#e5dac3] text-black ml-1.5 flex items-center justify-center">
              <ChevronLeft size={18} />
            </div>
          </div>

          {/* Right Stacked Page Edges */}
          <div
            onClick={() => triggerPageTurn("next")}
            className="absolute right-0 top-0 bottom-0 w-[48px] z-40 cursor-pointer group hover:bg-black/[0.03] transition-all duration-300 flex items-center justify-end pr-3 no-print"
            title="Click to turn to next day"
          >
            <div className="absolute right-0 inset-y-0 w-[12px] flex justify-end pointer-events-none">
              <div className="w-[3px] h-full bg-[#faf6ee] border-l border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#efe6d0] border-l border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#e7dcc2] border-l border-[#c4b391]/30" />
            </div>
            <div className="opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all duration-300 bg-white/90 p-2.5 rounded-full shadow-lg border border-[#e5dac3] text-black mr-1.5 flex items-center justify-center">
              <ChevronRight size={18} />
            </div>
          </div>

          <div className="grid grid-cols-2 relative bg-[#F7F1E3] min-h-[820px]">
            {/* 3D Double-Sided Flipbook sheet */}
            {isFlipping && (
              <div className={`pl-flip-container ${flipDirection === "next" ? "pl-flip-next" : "pl-flip-prev"}`}>
                <div className="pl-flip-page-front">
                  <div className="pl-flip-mock-content space-y-4 font-handwritten">
                    <div className="border-b border-[#A33A32]/25 pb-1">
                      <div className="grid grid-cols-[65px_1fr_95px] font-bold text-[#A33A32] text-xs">
                        <span>Qty (L)</span>
                        <span>Particulars / Accounts</span>
                        <span className="text-right">Amount (₹)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pl-flip-page-back">
                  <div className="pl-flip-mock-content space-y-4 font-handwritten" />
                </div>
              </div>
            )}

            {/* Central spine fold crease */}
            <div className="absolute inset-y-0 left-1/2 -ml-2.5 w-5 bg-gradient-to-r from-black/10 via-black/30 to-black/10 z-30 pointer-events-none border-l border-r border-black/5" />

            {/* ========================================================
                LEFT PAGE: VOUCHERS, EXPENSES & CASH CASCADE
               ======================================================== */}
            <div className="pl-register-page-left flex flex-col justify-between select-none">
              <div
                onClick={() => triggerPageTurn("prev")}
                className="pl-page-corner-left no-print"
                title="Click to turn to previous day"
              />

              <div className="pl-register-page-header">
                <div className="text-[10px] leading-3.5 text-neutral-700 rotate-[-0.5deg]" />
                <div className="text-center flex-1 pr-6 flex flex-col items-center">
                  <span className="pl-handwritten-header pl-handwritten-red tracking-widest font-bold">
                    {stationName} — Daily Register
                  </span>
                  <div className="text-[10px] font-mono font-bold inline-block px-4 select-all text-neutral-800">
                    {formattedDateHeader}
                    {totalPages > 1 ? ` (Sheet ${currentPageIndex + 1} of ${totalPages})` : ""}
                  </div>
                </div>
              </div>

              {/* Transactions grid */}
              <div className="text-xs space-y-0 flex-1">
                <div className="grid grid-cols-[65px_1fr_95px] border-b-2 border-[#A33A32] pl-handwritten-red font-bold h-[20px] items-center">
                  <div className="text-center pr-2 border-r border-[#A33A32]/25">Qty (L)</div>
                  <div className="pl-4">Particulars / Customer Accounts</div>
                  <div className="text-right">Amount (₹)</div>
                </div>

                <div className="space-y-[0px]">
                  {visibleVouchers.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[65px_1fr_95px] h-[20px] items-center">
                      <div className="text-center pl-handwritten pr-2 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[13px]">
                        {row.quantity_liters > 0 ? row.quantity_liters.toFixed(2) : "—"}
                      </div>
                      <div className="pl-4 truncate pr-2 h-full flex items-center">
                        <span className="pl-handwritten-strong">{row.customer_name}</span>
                      </div>
                      <div className="text-right font-bold pr-1 pl-handwritten-strong h-full flex items-center justify-end text-[13px]">
                        {formatLedgerAmount(row.amount)}
                      </div>
                    </div>
                  ))}

                  {/* Real Expense Items in red ink */}
                  {realExpenses.map((row) => (
                    <div
                      key={row.uuid}
                      className="group grid grid-cols-[65px_1fr_95px] h-[20px] items-center rotate-[-0.1deg]"
                    >
                      <div className="text-center pr-2 border-r border-[#A33A32]/25 text-neutral-500 h-full flex items-center justify-center">
                        Exp
                      </div>
                      <div className="pl-4 truncate h-full flex items-center justify-between pr-1">
                        <span className="pl-handwritten-red truncate">{row.customer_name}</span>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => deleteEntryMutation.mutate(row.uuid)}
                            className="opacity-0 group-hover:opacity-100 text-[#A33A32] hover:text-red-700 ml-1 no-print cursor-pointer"
                            title="Delete expense"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      <div className="text-right pr-1 pl-handwritten-red h-full flex items-center justify-end text-[13px]">
                        {formatLedgerAmount(row.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Cash Denomination Breakdown */}
              <div className="mt-2 border-t-2 border-[#A33A32]/50 pt-2 grid grid-cols-[1.25fr_1fr] gap-4 text-[#2B2621]">
                <div className="border-r border-[#A33A32]/25 pr-3 text-[11px] leading-5 rotate-[-0.5deg]">
                  <div className="border-b border-[#A33A32]/25 mb-1 text-[12px] pl-handwritten-red font-bold">
                    Cash Collection Counts
                  </div>

                  <div className="space-y-[0px] pl-handwritten">
                    {DENOMINATIONS.map(({ value, key }) => (
                      <div key={key} className="grid grid-cols-[34px_10px_1fr_10px_auto] items-center gap-1 h-[20px]">
                        <span className="text-right">{value}</span>
                        <span className="text-center">×</span>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={notes[key] || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const updated = { ...notes, [key]: parseInt(e.target.value) || 0 };
                            setNotes(updated);
                            saveDenominations(updated);
                          }}
                          className="bg-transparent border-b border-dashed border-[#1C2B4A]/25 text-black font-bold text-center w-full h-4 outline-none hover:bg-yellow-50/50 focus:bg-yellow-50 focus:border-solid pl-handwritten text-[13px]"
                        />
                        <span className="text-center">=</span>
                        <span className="pl-handwritten-strong font-bold text-neutral-800 pr-1 text-[13px] text-right min-w-[64px]">
                          {(notes[key] * value).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                    <div className="grid grid-cols-[34px_10px_1fr_10px_auto] items-center gap-1 h-[20px] border-t border-[#A33A32]/30 font-bold">
                      <span className="col-span-4 text-right pr-1 text-[#A33A32]">Total</span>
                      <span className="pl-handwritten-strong text-neutral-900 text-[13px] text-right min-w-[64px]">
                        {totalCashCounted.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-end text-[11px] leading-4 select-none pl-1 font-handwritten">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 h-[20px]">
                    <span className="truncate">Cash Collection:</span>
                    <span className="pl-handwritten-strong font-bold text-neutral-800 text-[13px] text-right">
                      {totalCashCounted.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 border-b border-[#A33A32]/25 h-[20px]">
                    <span className="text-[#A33A32] truncate">Slips &amp; Expenses:</span>
                    <span className="pl-handwritten-strong font-bold text-neutral-800 text-[13px] text-right">
                      {(totalVouchersAmount + totalExpensesAmount).toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 h-[20px]">
                    <span className="truncate">Cash Sent Home:</span>
                    <input
                      type="number"
                      disabled={isLocked}
                      value={cashHome || ""}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCashHome(val);
                        saveDenominations(notes, val, prevDeposit, ledgerInterest);
                      }}
                      className="bg-transparent border-b border-dashed border-[#1C2B4A]/25 text-black font-bold text-right w-24 h-4 outline-none hover:bg-yellow-50/50 focus:bg-yellow-50 focus:border-solid pl-handwritten text-[13px]"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 border-b border-[#A33A32]/20 h-[20px]">
                    <span className="truncate">Deposited to Bank:</span>
                    <input
                      type="number"
                      disabled={isLocked}
                      value={prevDeposit || ""}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPrevDeposit(val);
                        saveDenominations(notes, cashHome, val, ledgerInterest);
                      }}
                      className="bg-transparent border-b border-dashed border-[#1C2B4A]/25 text-black font-bold text-right w-24 h-4 outline-none hover:bg-yellow-50/50 focus:bg-yellow-50 focus:border-solid pl-handwritten text-[13px]"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 font-bold text-red-800 border-t-2 border-double border-[#A33A32]/50 h-[20px]">
                    <span className="pl-handwritten-red truncate">Grand Total:</span>
                    <span className="pl-handwritten-strong underline decoration-double decoration-[#A33A32] text-neutral-900 text-[13px] text-right">
                      {grandTotalLeft.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================
                RIGHT PAGE: EDITABLE NOZZLE METER LOGS & RECONCILIATION
               ======================================================== */}
            <div className="pl-register-page-right flex flex-col select-none">
              <div
                onClick={() => triggerPageTurn("next")}
                className="pl-page-corner-right no-print"
                title="Click to turn to next day"
              />

              <div className="pl-register-page-header">
                <div className="text-center flex-1 flex flex-col items-center">
                  <span className="pl-handwritten-header pl-handwritten-red tracking-widest font-bold">
                    Nozzle Readings &amp; Fuel Reconciliation
                  </span>
                  <div className="text-[10px] font-mono font-bold inline-block px-4 text-neutral-800">
                    {formattedDateHeader}{" "}
                    <span className="text-[9px] text-neutral-500 font-normal no-print">
                      (Click closing reading &amp; press Enter for next nozzle)
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable Nozzle Readings inside the book lines */}
              <div className="text-[12px] relative mt-[0px]">
                {activeNozzles.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-600 font-sans">
                    No nozzles configured yet.{" "}
                    <Link to="/dashboard/inventory" className="text-[#A33A32] underline font-semibold">
                      Add Tanks &amp; Nozzles in Inventory →
                    </Link>
                  </div>
                ) : (
                  Object.entries(groupedDispensers).map(([dispName, dispNozzles], dispIdx, arr) => (
                    <React.Fragment key={dispName}>
                      <div className="relative">
                        <div className="absolute -left-[68px] top-0 w-[64px] text-right pl-handwritten-strong font-bold text-[#A33A32] text-[11px] h-[80px] flex items-center justify-end select-none z-20">
                          {dispName}
                        </div>

                        {/* Row 1: Nozzle Names */}
                        <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten-strong text-[#103F91] font-bold">
                          {dispNozzles.map((noz) => (
                            <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center">
                              {noz.nozzle_name}
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                            <div key={`ph1-${i}`} className="h-full" />
                          ))}
                        </div>

                        {/* Row 2: Editable Closing Readings directly inside the book */}
                        <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten-strong text-[#103F91] font-bold">
                          {dispNozzles.map((noz) => (
                            <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center px-1">
                              <input
                                ref={(el) => {
                                  closingInputRefs.current[noz.idx] = el;
                                }}
                                type="number"
                                step="0.01"
                                disabled={isLocked}
                                value={noz.closing_str}
                                placeholder="Closing"
                                onChange={(e) =>
                                  updateNozzleDraft(noz.nozzle_uuid, { closing: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  const nextEl = closingInputRefs.current[noz.idx + 1];
                                  if (nextEl) {
                                    nextEl.focus();
                                    nextEl.select();
                                  } else if (!isLocked && !saveReadingsMutation.isPending) {
                                    saveReadingsMutation.mutate();
                                  }
                                }}
                                className="w-full max-w-[92px] h-4 bg-transparent border-b border-dashed border-[#103F91]/40 text-center text-[#103F91] font-bold outline-none focus:bg-yellow-50/70 focus:border-solid pl-handwritten-strong text-[13px]"
                              />
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                            <div key={`ph2-${i}`} className="h-full" />
                          ))}
                        </div>

                        {/* Optional Row: 6 AM Interim Reading (when rate changed at 6 AM) */}
                        {rateChanged6am && (
                          <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten text-[#A33A32] text-[11px]">
                            {dispNozzles.map((noz) => (
                              <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center px-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={isLocked}
                                  value={noz.interim_str}
                                  placeholder="6 AM"
                                  onChange={(e) =>
                                    updateNozzleDraft(noz.nozzle_uuid, { interim6am: e.target.value })
                                  }
                                  className="w-full max-w-[92px] h-4 bg-transparent border-b border-dashed border-[#A33A32]/40 text-center text-[#A33A32] outline-none focus:bg-yellow-50/70 text-[11px]"
                                />
                              </div>
                            ))}
                            {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                              <div key={`ph6-${i}`} className="h-full" />
                            ))}
                          </div>
                        )}

                        {/* Row 3: Opening Readings */}
                        <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten text-[#103F91]">
                          {dispNozzles.map((noz) => (
                            <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center">
                              {noz.opening_reading > 0 ? noz.opening_reading.toLocaleString() : "0"}
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                            <div key={`ph3-${i}`} className="h-full" />
                          ))}
                        </div>

                        {/* Row 4: Difference (Raw Liters Sold) */}
                        <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten-strong text-[#103F91] font-bold">
                          {dispNozzles.map((noz) => (
                            <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center">
                              {noz.hasClosing ? `${noz.rawSales.toLocaleString()} L` : "—"}
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                            <div key={`ph4-${i}`} className="h-full" />
                          ))}
                        </div>
                      </div>

                      {dispIdx < arr.length - 1 && <div className="h-[20px]" />}
                    </React.Fragment>
                  ))
                )}
              </div>

              {/* Fuel type calculation equations */}
              <div className="pr-8">
                <div className="h-[20px]" />

                {[
                  { label: "H.S.D", summary: hsdSummary, rate: hsdRate, amt: hsdAmt },
                  { label: "M.S", summary: msSummary, rate: msRate, amt: msAmt },
                  { label: "Speed", summary: speedSummary, rate: msRate2, amt: speedAmt },
                ].map(({ label, summary, rate, amt }) => (
                  <div
                    key={label}
                    className="flex items-center h-[20px] pl-handwritten text-[#103F91] text-[13px]"
                  >
                    <span className="font-bold text-[#A33A32] w-[50px] shrink-0">{label}</span>
                    <span className="pl-1">= {summary.rawQty.toLocaleString()}</span>
                    <span className="pl-1">- {summary.testing.toLocaleString()}</span>
                    <span className="pl-1">= {summary.netVol.toLocaleString()} L</span>
                    <span className="text-[#A33A32] pl-1">× {rate}</span>
                    <span className="ml-auto font-bold pl-handwritten-strong text-[13px] pr-1">
                      {formatLedgerAmount(amt)}
                    </span>
                  </div>
                ))}

                <div className="h-[20px]" />

                {/* Cash Income & Recoveries */}
                <div className="border-t border-[#A33A32]/30">
                  {activeVouchers
                    .filter((row) => !/\[(CREDIT|UPI|CARD)\]/i.test(row.customer_name))
                    .map((row, idx) => (
                      <div key={idx} className="flex items-center h-[20px] pl-handwritten text-[12px]">
                        <span className="truncate flex-1 pr-2">{row.customer_name}</span>
                        <span className="pl-handwritten-strong font-bold text-[13px] pr-1 shrink-0">
                          {formatLedgerAmount(row.amount)}
                        </span>
                      </div>
                    ))}
                  {realCashOtherIncomes.map((row) => (
                    <div key={row.uuid} className="group flex items-center h-[20px] pl-handwritten text-[12px]">
                      <span className="truncate flex-1 pr-2">
                        {row.customer_name}
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => deleteEntryMutation.mutate(row.uuid)}
                            className="opacity-0 group-hover:opacity-100 text-rose-600 ml-1 no-print cursor-pointer"
                            title="Delete income"
                          >
                            <Trash2 size={11} className="inline" />
                          </button>
                        )}
                      </span>
                      <span className="pl-handwritten-strong font-bold text-[13px] pr-1 shrink-0">
                        {formatLedgerAmount(row.amount)}
                      </span>
                    </div>
                  ))}
                  {cashPaymentsForDate.map((p) => (
                    <div key={p.uuid} className="flex items-center h-[20px] pl-handwritten text-[12px]">
                      <span className="truncate flex-1 pr-2">Jama: {p.customer_name} [CASH]</span>
                      <span className="pl-handwritten-strong font-bold text-[13px] pr-1 shrink-0">
                        {formatLedgerAmount(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="h-[20px]" />

                {/* Grand Total */}
                <div className="flex justify-between text-red-800 font-bold text-sm border-t-2 border-double border-[#A33A32]/50 h-[20px] items-center">
                  <span className="pl-handwritten-red">Grand Total:</span>
                  <span className="pl-handwritten-strong underline decoration-double decoration-[#A33A32] text-neutral-900 text-[14px] pr-1">
                    {grandTotalRight.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
