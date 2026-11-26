import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/common/PageHeader";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import UpiCollectionBreakdown from "@/components/common/UpiCollectionBreakdown";
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
import dayClosingService from "@/features/day-closing/services/dayClosingService";
import bankAccountService from "@/features/admin/services/bankAccountService";
import type { FuelType, PaymentMode as VoucherPaymentMode } from "@/types/voucher";
import { formatCurrency } from "@/lib/utils";
import { getWhatsAppShareUrl } from "@/lib/whatsapp";
import api from "@/api/client";

const DENOMINATIONS = [
  { value: 500, key: "n500" },
  { value: 200, key: "n200" },
  { value: 100, key: "n100" },
  { value: 50, key: "n50" },
  { value: 20, key: "n20" },
  { value: 10, key: "n10" },
] as const;

type LeftEntryMode =
  | "CREDIT"
  | "CASH"
  | "INC_CASH"
  | "UPI"
  | "CARD"
  | "EXP_CASH"
  | "EXP_BANK"
  | "LEND_CASH";

type RightEntryMode = "INCOME" | "LEND_CASH";

function formatLedgerAmount(val: number): string {
  const safeVal = Number(val) || 0;
  const base = Math.floor(safeVal);
  const paise = Math.round((safeVal - base) * 100);
  const paiseStr = paise === 0 ? "00" : paise.toString().padStart(2, "0");
  return `${base.toLocaleString("en-IN")}=${paiseStr}`;
}

function fmtTrim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

interface NozzleDraftItem {
  opening: string;
  closing: string;
  net: string;
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

  // Nozzle inline editing + Enter navigation across Opening / Closing / Net rows
  const [nozzleDrafts, setNozzleDrafts] = useState<Record<string, NozzleDraftItem>>({});
  const [hasUnsavedReadings, setHasUnsavedReadings] = useState(false);
  const [rateChanged6am, setRateChanged6am] = useState(false);
  const openingInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const closingInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const netInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Left Page inline entry: Qty -> Particulars (+ Mode / UPI / Fuel) -> Amount -> Save
  const [leftQty, setLeftQty] = useState("");
  const [leftParticulars, setLeftParticulars] = useState("");
  const [leftAmt, setLeftAmt] = useState("");
  const [leftMode, setLeftMode] = useState<LeftEntryMode>("CREDIT");
  const [leftFuel, setLeftFuel] = useState<FuelType>("DIESEL");
  const [leftUpiUuid, setLeftUpiUuid] = useState("");
  const [leftUpiBankUuid, setLeftUpiBankUuid] = useState("");
  const leftQtyRef = useRef<HTMLInputElement | null>(null);
  const leftParticularsRef = useRef<HTMLInputElement | null>(null);
  const leftAmtRef = useRef<HTMLInputElement | null>(null);

  // Right Page inline Cash Income / Money Lended entry
  const [rightMode, setRightMode] = useState<RightEntryMode>("INCOME");
  const [rightDesc, setRightDesc] = useState("");
  const [rightAmt, setRightAmt] = useState("");
  const rightDescRef = useRef<HTMLInputElement | null>(null);
  const rightAmtRef = useRef<HTMLInputElement | null>(null);

  // Tank Dip & Closing controls
  const [showDips, setShowDips] = useState(false);
  const [tankDips, setTankDips] = useState<Record<string, string>>({});
  const [cashToNextDay, setCashToNextDay] = useState("2000");
  const [settlementBankUuid, setSettlementBankUuid] = useState("");

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

  const { data: vouchersData, refetch: refetchVouchers } = useVoucherList({
    from_date: date,
    to_date: date,
    page_size: 200,
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
    queryFn: () => incomeService.getIncomes({ income_date: date, page_size: 100 }),
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

  const { data: upiAccounts } = useQuery({
    queryKey: ["upi-accounts"],
    queryFn: () => bankAccountService.getUpiAccounts(),
    enabled: !isOperator,
  });

  const { data: upiSummaryData } = useQuery({
    queryKey: ["upi-collection-summary", date],
    queryFn: () => bankAccountService.getUpiCollectionSummary(date),
    enabled: !isOperator,
  });

  const priceSchedulesQuery = useQuery({
    queryKey: ["priceSchedules"],
    queryFn: () => inventoryService.getPriceSchedules(),
    enabled: !isOperator,
  });

  useEffect(() => {
    if (bankAccounts && bankAccounts.length > 0 && !settlementBankUuid) {
      setSettlementBankUuid(bankAccounts[0].uuid);
    }
  }, [bankAccounts, settlementBankUuid]);

  useEffect(() => {
    if (upiAccounts && upiAccounts.length > 0 && !leftUpiUuid) {
      setLeftUpiUuid(upiAccounts[0].uuid);
      setLeftUpiBankUuid(upiAccounts[0].bank_account_uuid || "");
    }
  }, [upiAccounts, leftUpiUuid]);

  // Seed nozzle drafts (Opening, Closing, Net, 6AM, Testing)
  useEffect(() => {
    if (!nozzleData?.items) return;
    let savedDraft: Record<string, Partial<NozzleDraftItem>> = {};
    let hadSavedDraft = false;
    try {
      const raw = localStorage.getItem(nozzleDraftKey);
      if (raw) {
        savedDraft = JSON.parse(raw);
        hadSavedDraft = Object.keys(savedDraft).length > 0;
      }
    } catch {
      // ignore
    }

    const next: Record<string, NozzleDraftItem> = {};
    let has6am = false;
    for (const item of nozzleData.items) {
      const local = savedDraft[item.nozzle_uuid];
      const openStr = local?.opening ?? String(Number(item.opening_reading) || 0);
      const closeStr =
        local?.closing ??
        (item.closing_reading != null ? String(item.closing_reading) : "");
      const testStr = local?.testing ?? (item.testing != null ? String(item.testing) : "0");
      const interimVal =
        local?.interim6am ??
        (item.interim_6am_reading != null ? String(item.interim_6am_reading) : "");
      if (interimVal) has6am = true;

      let netStr = local?.net ?? "";
      if (!local?.net && closeStr !== "") {
        const o = Number(openStr) || 0;
        const c = Number(closeStr);
        const cap = Number(item.meter_capacity) || 999999;
        const rawSales = c >= o ? c - o : cap - o + c;
        netStr = fmtTrim(Math.max(0, rawSales - (Number(testStr) || 0)));
      }

      next[item.nozzle_uuid] = {
        opening: openStr,
        closing: closeStr,
        net: netStr,
        interim6am: interimVal,
        testing: testStr,
      };
    }
    setNozzleDrafts(next);
    setHasUnsavedReadings(hadSavedDraft);
    if (has6am) setRateChanged6am(true);
  }, [nozzleData, nozzleDraftKey]);

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
    queryClient.invalidateQueries({ queryKey: ["upi-collection-summary"] });
    queryClient.invalidateQueries({ queryKey: ["report-pnl"] });
    queryClient.invalidateQueries({ queryKey: ["vouchers"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  const persistNozzleDrafts = (updated: Record<string, NozzleDraftItem>) => {
    try {
      localStorage.setItem(nozzleDraftKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setHasUnsavedReadings(true);
  };

  // Bidirectional nozzle field updater (Opening / Closing <-> Net)
  const handleNozzleFieldChange = (
    nozzleUuid: string,
    field: "opening" | "closing" | "net" | "interim6am",
    value: string,
    defaultOpening: number,
    meterCapacity: number
  ) => {
    setNozzleDrafts((prev) => {
      const cur = prev[nozzleUuid] ?? {
        opening: String(defaultOpening),
        closing: "",
        net: "",
        interim6am: "",
        testing: "0",
      };
      const nextItem: NozzleDraftItem = { ...cur, [field]: value };
      const o = Number(field === "opening" ? value : cur.opening) || 0;
      const t = Number(cur.testing) || 0;
      const cap = meterCapacity || 999999;

      if (field === "opening" || field === "closing") {
        const cStr = field === "closing" ? value : cur.closing;
        if (cStr !== "" && !Number.isNaN(Number(cStr))) {
          const c = Number(cStr);
          const raw = c >= o ? c - o : cap - o + c;
          nextItem.net = fmtTrim(Math.max(0, raw - t));
        } else if (field === "closing" && value === "") {
          nextItem.net = "";
        }
      } else if (field === "net") {
        if (value !== "" && !Number.isNaN(Number(value))) {
          const netVal = Math.max(0, Number(value));
          const computedClose = o + netVal + t;
          nextItem.closing = fmtTrim(
            computedClose >= cap && cap > 0 ? computedClose % cap : computedClose
          );
        } else {
          nextItem.closing = "";
        }
      }

      const updated = { ...prev, [nozzleUuid]: nextItem };
      persistNozzleDrafts(updated);
      return updated;
    });
  };

  const saveReadingsMutation = useMutation({
    mutationFn: async () => {
      if (!nozzleData?.items) return;
      const readings = nozzleData.items
        .map((item) => {
          const d = nozzleDrafts[item.nozzle_uuid];
          const openNum = d?.opening !== "" && d?.opening !== undefined ? Number(d.opening) : Number(item.opening_reading) || 0;
          const testNum = Number(d?.testing || 0);
          let closingNum: number | null =
            d?.closing !== "" && d?.closing !== undefined && !Number.isNaN(Number(d.closing))
              ? Number(d.closing)
              : null;

          // If user typed Net without Closing, auto-compute Closing from Opening + Net + Testing
          if (closingNum === null && d?.net !== "" && d?.net !== undefined && !Number.isNaN(Number(d.net))) {
            const cap = Number(item.meter_capacity) || 999999;
            const rawClose = openNum + Math.max(0, Number(d.net)) + testNum;
            closingNum = rawClose >= cap && cap > 0 ? rawClose % cap : rawClose;
          }

          if (closingNum === null) return null;

          const interimNum =
            rateChanged6am && d?.interim6am !== "" && d?.interim6am !== undefined && !Number.isNaN(Number(d.interim6am))
              ? Number(d.interim6am)
              : null;

          return {
            nozzle_uuid: item.nozzle_uuid,
            opening_reading: openNum,
            closing_reading: closingNum,
            interim_6am_reading: interimNum,
            testing_liters: testNum,
            return_testing_to_storage: true,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (readings.length === 0) {
        throw new Error("Enter closing reading or net liters for at least one nozzle.");
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
      toast.success("Meter readings saved — Tank stock & profit updated!");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to save readings");
    },
  });

  const normalizeFuelType = (ft: string): "DIESEL" | "PETROL" | "SPEED" => {
    if (!ft) return "PETROL";
    const upper = ft.toUpperCase();
    if (upper.includes("DIESEL") || upper.includes("HSD")) return "DIESEL";
    if (upper.includes("SPEED")) return "SPEED";
    return "PETROL";
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

  const ROWS_PER_PAGE = 14;

  // Save Left Page entry (Voucher OR Expense OR Money Lended) and auto-advance sheet if full
  const saveLeftBookEntryMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(leftAmt);
      if (!amt || amt <= 0) {
        throw new Error("Enter a valid positive amount.");
      }
      const desc = leftParticulars.trim();

      if (leftMode === "INC_CASH") {
        if (!desc) {
          throw new Error("Enter description for cash income.");
        }
        return incomeService.createIncome({
          kind: "INCOME",
          income_date: date,
          description: desc,
          amount: amt,
          category: "Other Income",
          payment_mode: "CASH",
        });
      }

      if (leftMode === "EXP_CASH" || leftMode === "EXP_BANK" || leftMode === "LEND_CASH") {
        if (!desc) {
          throw new Error(
            leftMode === "LEND_CASH"
              ? "Enter customer name for money lended."
              : "Enter expense description."
          );
        }
        return incomeService.createIncome({
          kind: "EXPENSE",
          income_date: date,
          description: leftMode === "LEND_CASH" ? `Loan to ${desc}` : desc,
          amount: amt,
          category: leftMode === "LEND_CASH" ? "Customer Loan" : "Daily Expense",
          payment_mode: leftMode === "EXP_BANK" ? "BANK" : "CASH",
          bank_account_uuid: leftMode === "EXP_BANK" ? settlementBankUuid || null : null,
          customer_name: leftMode === "LEND_CASH" ? desc : undefined,
        });
      }

      // Voucher entry (CREDIT, CASH, UPI, CARD)
      if (leftMode === "CREDIT" && !desc) {
        throw new Error("Enter customer name for a Credit slip.");
      }

      const activeFuelRate =
        leftFuel === "DIESEL" ? hsdRate : leftFuel === "SPEED" ? msRate2 : msRate;
      const qtyNum =
        leftQty !== "" && !Number.isNaN(Number(leftQty)) && Number(leftQty) > 0
          ? Number(leftQty)
          : Number((amt / activeFuelRate).toFixed(2));
      const ratePerLiter =
        qtyNum > 0 ? Number((amt / qtyNum).toFixed(2)) : activeFuelRate;

      const selectedUpi = upiAccounts?.find((u) => u.uuid === leftUpiUuid);
      const bankForVoucher =
        leftMode === "UPI"
          ? leftUpiBankUuid || selectedUpi?.bank_account_uuid || settlementBankUuid || undefined
          : leftMode === "CARD"
          ? settlementBankUuid || undefined
          : undefined;

      const voucherCustomerName =
        desc ||
        (leftMode === "UPI" && selectedUpi
          ? `${selectedUpi.name} (${selectedUpi.provider})`
          : leftMode === "CARD"
          ? "Card EDC Sale"
          : "Cash Sale");

      return voucherService.createVoucher({
        invoice_number: `REG-${date.replace(/-/g, "")}-${Date.now().toString().slice(-5)}`,
        invoice_date: date,
        customer_name: voucherCustomerName,
        fuel_type: leftFuel,
        quantity_liters: qtyNum,
        rate_per_liter: ratePerLiter,
        total_amount: amt,
        payment_mode: leftMode as VoucherPaymentMode,
        bank_account_uuid: bankForVoucher,
        remarks:
          leftMode === "UPI" && selectedUpi
            ? `${selectedUpi.provider}:${selectedUpi.name}`
            : undefined,
      });
    },
    onSuccess: () => {
      if (leftMode === "INC_CASH" || leftMode === "CASH") {
        toast.success("Added to Cash Income below nozzle readings on Right Page!");
      } else {
        const nextCount = combinedLeftRows.length + 1;
        const nextLastPage = Math.max(0, Math.ceil(nextCount / ROWS_PER_PAGE) - 1);
        if (nextLastPage > currentPageIndex) {
          setPageIndex(nextLastPage);
          toast.success(`Saved! Sheet full — moved to Sheet ${nextLastPage + 1}.`);
        } else {
          toast.success("Entry added to register!");
        }
      }
      setLeftQty("");
      setLeftParticulars("");
      setLeftAmt("");
      invalidateAll();
      setTimeout(() => leftQtyRef.current?.focus(), 40);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Could not save entry");
    },
  });

  // Save Right Page entry (Cash Income OR Money Lended)
  const saveRightBookEntryMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(rightAmt);
      const desc = rightDesc.trim();
      if (!desc || !amt || amt <= 0) {
        throw new Error("Enter name/description and positive amount.");
      }
      if (rightMode === "LEND_CASH") {
        return incomeService.createIncome({
          kind: "EXPENSE",
          income_date: date,
          description: `Loan to ${desc}`,
          amount: amt,
          category: "Customer Loan",
          payment_mode: "CASH",
          customer_name: desc,
        });
      }
      return incomeService.createIncome({
        kind: "INCOME",
        income_date: date,
        description: desc,
        amount: amt,
        category: "Other Income",
        payment_mode: "CASH",
      });
    },
    onSuccess: () => {
      toast.success(
        rightMode === "LEND_CASH"
          ? "Money lended saved to Customer Ledger & Register!"
          : "Cash income added to register!"
      );
      setRightDesc("");
      setRightAmt("");
      invalidateAll();
      setTimeout(() => rightDescRef.current?.focus(), 40);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Could not save entry");
    },
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (uuid: string) => incomeService.deleteIncome(uuid),
    onSuccess: () => {
      toast.success("Entry deleted");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not delete entry");
    },
  });

  const deleteVoucherMutation = useMutation({
    mutationFn: (uuid: string) => voucherService.deleteVoucher(uuid),
    onSuccess: () => {
      toast.success("Slip removed");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Could not remove slip");
    },
  });

  const updateFuelTesting = (fuelKey: "DIESEL" | "PETROL" | "SPEED", valStr: string) => {
    const matchNozzle = nozzleData?.items?.find((n) => normalizeFuelType(n.fuel_type) === fuelKey);
    if (!matchNozzle) {
      toast.error(`No ${fuelKey} nozzle configured yet.`);
      return;
    }
    const tankTest = getTankStorageTestingFor(fuelKey);
    const totalNum = Math.max(0, Number(valStr) || 0);
    const nozzleTest = Math.max(0, totalNum - tankTest);
    setNozzleDrafts((prev) => {
      const next = { ...prev };
      for (const item of nozzleData?.items ?? []) {
        if (normalizeFuelType(item.fuel_type) === fuelKey) {
          const cur = next[item.nozzle_uuid] ?? {
            opening: String(Number(item.opening_reading) || 0),
            closing: item.closing_reading != null ? String(item.closing_reading) : "",
            net: "",
            interim6am: item.interim_6am_reading != null ? String(item.interim_6am_reading) : "",
            testing: "0",
          };
          const updatedTest = item.nozzle_uuid === matchNozzle.nozzle_uuid ? String(nozzleTest) : "0";
          let nextNet = cur.net;
          if (cur.closing !== "" && !Number.isNaN(Number(cur.closing))) {
            const o = Number(cur.opening) || 0;
            const c = Number(cur.closing);
            const cap = Number(item.meter_capacity) || 999999;
            const raw = c >= o ? c - o : cap - o + c;
            nextNet = fmtTrim(Math.max(0, raw - Number(updatedTest)));
          }
          next[item.nozzle_uuid] = { ...cur, testing: updatedTest, net: nextNet };
        }
      }
      persistNozzleDrafts(next);
      return next;
    });
  };

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
      target.closest("select") ||
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

  const realExpenses = (incomesData?.items ?? [])
    .filter((item) => item.kind === "EXPENSE")
    .map((item) => ({
      uuid: item.uuid,
      kind: "EXPENSE" as const,
      typeLabel: Boolean(item.customer_uuid || item.category === "Customer Loan") ? "Loan" : "Exp",
      quantity_liters: 0,
      customer_name: item.customer_name
        ? `${item.description} (${item.customer_name})`
        : `${item.description} (${item.payment_mode})`,
      amount: Number(item.amount ?? 0),
      isLoan: Boolean(item.customer_uuid || item.category === "Customer Loan"),
    }));

  const realCashOtherIncomes = (incomesData?.items ?? [])
    .filter((item) => item.kind === "INCOME" && item.payment_mode === "CASH")
    .map((item) => ({
      uuid: item.uuid,
      customer_name: `${item.description} [CASH]`,
      amount: Number(item.amount ?? 0),
    }));

  const totalExpensesAmount = realExpenses.reduce((s, e) => s + e.amount, 0);

  const activeVouchers = vouchersData?.items?.length
    ? vouchersData.items.map((v) => ({
        uuid: v.uuid,
        kind: "VOUCHER" as const,
        paymentMode: v.payment_mode,
        typeLabel:
          v.payment_mode === "CREDIT"
            ? "Credit"
            : v.payment_mode === "CARD"
            ? "Card"
            : v.payment_mode === "UPI"
            ? "UPI"
            : "Cash",
        quantity_liters: Number(v.quantity_liters ?? 0),
        customer_name:
          (v.customer_name || "Cash Customer") +
          (v.vehicle_number ? ` (${v.vehicle_number})` : ""),
        amount: Number(v.total_amount ?? 0),
        isLoan: false,
      }))
    : [];

  // Auto-grouped per-UPI-account rows (e.g. Paytm = 10,020, PhonePe = 2,000)
  const autoUpiRows = (upiSummaryData?.items ?? [])
    .filter((u) => Number(u.amount ?? 0) > 0)
    .map((u) => ({
      uuid: `upi-sum-${u.upi_uuid}`,
      kind: "UPI_SUMMARY" as const,
      typeLabel: "UPI",
      quantity_liters: 0,
      customer_name: `${u.name} (${u.provider}${u.bank_name ? ` → ${u.bank_name}` : ""}) [${u.txn_count} txns]`,
      amount: Number(u.amount ?? 0),
      isLoan: false,
    }));

  const nonUpiVouchers = activeVouchers.filter(
    (v) => v.paymentMode !== "UPI" && v.paymentMode !== "CASH"
  );
  const totalNonUpiVouchers = nonUpiVouchers.reduce((sum, item) => sum + item.amount, 0);
  const totalAutoUpiAmount = autoUpiRows.reduce((sum, item) => sum + item.amount, 0);
  const totalVouchersAndUpi = totalNonUpiVouchers + totalAutoUpiAmount;

  const paymentRank = (mode: string) =>
    mode === "CREDIT" ? 0 : mode === "CARD" ? 1 : 2;
  const sortedNonUpiVouchers = [...nonUpiVouchers].sort(
    (a, b) => paymentRank(a.paymentMode) - paymentRank(b.paymentMode)
  );

  // Unified Left-Page pagination across Vouchers + Auto UPI Account Summaries + Expenses
  const combinedLeftRows = [...sortedNonUpiVouchers, ...autoUpiRows, ...realExpenses];
  const totalPages = Math.max(1, Math.ceil(combinedLeftRows.length / ROWS_PER_PAGE));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleLeftRows = combinedLeftRows.slice(
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
    totalCashCounted + totalVouchersAndUpi + totalExpensesAmount + cashHome + prevDeposit;

  // Map Nozzles using live editable drafts (Opening, Closing, Net)
  const activeNozzles = nozzleData?.items?.length
    ? nozzleData.items.map((item, idx) => {
        const draftItem = nozzleDrafts[item.nozzle_uuid];
        const openStr = draftItem?.opening ?? String(Number(item.opening_reading) || 0);
        const openNum = Number(openStr) || 0;
        const closeStr =
          draftItem?.closing ?? (item.closing_reading != null ? String(item.closing_reading) : "");
        const closeNum =
          closeStr !== "" && !Number.isNaN(Number(closeStr)) ? Number(closeStr) : null;
        const testingNum =
          draftItem?.testing !== undefined
            ? Number(draftItem.testing) || 0
            : Number(item.testing) || 0;
        const interimStr =
          draftItem?.interim6am ??
          (item.interim_6am_reading != null ? String(item.interim_6am_reading) : "");
        const meterCap = Number(item.meter_capacity) || 999999;

        const rawSales =
          closeNum != null
            ? closeNum >= openNum
              ? closeNum - openNum
              : meterCap - openNum + closeNum
            : draftItem?.net !== undefined && draftItem.net !== "" && !Number.isNaN(Number(draftItem.net))
            ? Math.max(0, Number(draftItem.net)) + testingNum
            : 0;
        const netVol = Math.max(0, rawSales - testingNum);
        const netStr =
          draftItem?.net ?? (closeNum != null ? fmtTrim(netVol) : "");

        return {
          idx,
          nozzle_uuid: item.nozzle_uuid,
          nozzle_name: item.nozzle_name,
          dispenser_name: item.dispenser_name || (item.fuel_type === "DIESEL" ? "HSD I" : "MS I"),
          fuel_type: item.fuel_type,
          opening_reading: openNum,
          opening_str: openStr,
          closing_reading: closeNum,
          closing_str: closeStr,
          net_str: netStr,
          interim_str: interimStr,
          meter_capacity: meterCap,
          testing: testingNum,
          hasReading: closeNum != null || netStr !== "",
          rawSales,
          netVol,
        };
      })
    : [];

  const groupedDispensers: Record<string, typeof activeNozzles> = {};
  activeNozzles.forEach((item) => {
    if (!groupedDispensers[item.dispenser_name]) {
      groupedDispensers[item.dispenser_name] = [];
    }
    groupedDispensers[item.dispenser_name].push(item);
  });

  const rawSalesByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };
  const nozzleTestingByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };
  activeNozzles.forEach((item) => {
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
      `• Expenses & Loans: ${formatCurrency(expensesTotal)}`,
      `• Bank Deposit: ${formatCurrency(prevDeposit)}`,
      `• Cash Counted: ${formatCurrency(totalCashCounted)} (Expected ${formatCurrency(expectedCash)} | ${varianceStr})`,
      `• Net Profit: ${formatCurrency(profit?.net_profit ?? 0)}`,
    ];
    if (isLocked) lines.push("Status: CLOSED & LOCKED");
    window.open(getWhatsAppShareUrl(null, lines.join("\n")), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4 print-container">
      {/* Action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
        <PageHeader
          title="Daily Register"
          description="Type directly inside the register pages: Qty → Particulars → Payment/UPI → Amount, and Opening / Closing / Net readings."
        />

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

      {/* 4 Live Connected KPIs */}
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
              + OCR Scan
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

      {/* Compact Control Bar: 6 AM Toggle, Tank Dip, Sync Shift, Lock Day & WhatsApp + UPI Breakdown */}
      <div className="rounded-xl border border-hairline bg-surface-1 p-3 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
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
                <div
                  key={td.tank_uuid}
                  className="flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink truncate">{td.tank_name}</div>
                    <div className="text-[10px] text-ink-muted font-mono">
                      Book: {Number(td.book_stock ?? 0).toFixed(0)} L
                      {varL != null && (
                        <span
                          className={`ml-1.5 font-bold ${
                            varL < -50 ? "text-rose-500" : "text-emerald-500"
                          }`}
                        >
                          ({varL >= 0 ? "+" : ""}
                          {Number(varL).toFixed(0)} L)
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

        {/* Per-UPI Account Breakdown (Paytm, PhonePe, GPay, etc.) */}
        <UpiCollectionBreakdown date={date} />
      </div>

      {/* Real bound book container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={`pl-register-container overflow-x-auto min-w-[768px] ${
          isGrabbing ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        <div className="pl-book-shell relative min-w-[1000px] w-full max-w-[1250px] mx-auto min-h-[820px] rounded-2xl overflow-hidden border border-amber-950/30 touch-pan-y">
          {/* Left Stacked Page Edges */}
          <div
            onClick={() => triggerPageTurn("prev")}
            className="absolute left-0 top-0 bottom-0 w-[48px] z-40 cursor-pointer group hover:bg-black/[0.03] transition-all duration-300 flex items-center justify-start pl-3 no-print"
            title="Click to turn to previous page/day"
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
            title="Click to turn to next page/day"
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
            {isFlipping && (
              <div className={`pl-flip-container ${flipDirection === "next" ? "pl-flip-next" : "pl-flip-prev"}`}>
                <div className="pl-flip-page-front" />
                <div className="pl-flip-page-back" />
              </div>
            )}

            {/* Central spine fold crease */}
            <div className="absolute inset-y-0 left-1/2 -ml-2.5 w-5 bg-gradient-to-r from-black/10 via-black/30 to-black/10 z-30 pointer-events-none border-l border-r border-black/5" />

            {/* ========================================================
                LEFT PAGE: PARTICULARS (QTY -> PARTICULAR -> MODE/UPI -> AMT) & CASH
               ======================================================== */}
            <div className="pl-register-page-left flex flex-col justify-between select-none">
              <div
                onClick={() => triggerPageTurn("prev")}
                className="pl-page-corner-left no-print"
                title="Click to turn to previous page/day"
              />

              <div className="pl-register-page-header">
                <div className="text-[10px] leading-3.5 text-neutral-700 rotate-[-0.5deg]" />
                <div className="text-center flex-1 pr-6 flex flex-col items-center">
                  <span className="pl-handwritten-header pl-handwritten-red tracking-widest font-bold">
                    {stationName} — Daily Register
                  </span>
                  <div className="text-[10px] font-mono font-bold inline-flex items-center gap-2 px-4 text-neutral-800">
                    <span>{formattedDateHeader}</span>
                    {totalPages > 1 && (
                      <span className="inline-flex items-center gap-1 no-print">
                        <button
                          type="button"
                          disabled={currentPageIndex === 0}
                          onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                          className="px-1 rounded border border-[#A33A32]/30 disabled:opacity-30 cursor-pointer"
                        >
                          ‹
                        </button>
                        <span>
                          Sheet {currentPageIndex + 1}/{totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPageIndex >= totalPages - 1}
                          onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                          className="px-1 rounded border border-[#A33A32]/30 disabled:opacity-30 cursor-pointer"
                        >
                          ›
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions & Particulars grid (Type before Qty) */}
              <div className="text-xs space-y-0 flex-1">
                <div className="grid grid-cols-[62px_54px_1fr_92px] border-b-2 border-[#A33A32] pl-handwritten-red font-bold h-[20px] items-center">
                  <div className="text-center pr-1 border-r border-[#A33A32]/25">Type</div>
                  <div className="text-center pr-1 border-r border-[#A33A32]/25">Qty (L)</div>
                  <div className="pl-3">Particulars / Customer Accounts</div>
                  <div className="text-right">Amount (₹)</div>
                </div>

                <div className="space-y-[0px]">
                  {visibleLeftRows.map((row) =>
                    row.kind === "VOUCHER" ? (
                      <div key={row.uuid} className="group grid grid-cols-[62px_54px_1fr_92px] h-[20px] items-center">
                        <div className="text-center pr-1 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[10px] font-mono font-semibold text-[#103F91]">
                          {row.typeLabel}
                        </div>
                        <div className="text-center pl-handwritten pr-1 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[13px]">
                          {row.quantity_liters > 0 ? row.quantity_liters.toFixed(2) : "—"}
                        </div>
                        <div className="pl-3 truncate pr-2 h-full flex items-center justify-between">
                          <span className="pl-handwritten-strong truncate">{row.customer_name}</span>
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => deleteVoucherMutation.mutate(row.uuid)}
                              className="opacity-0 group-hover:opacity-100 text-[#A33A32] hover:text-red-700 ml-1 no-print cursor-pointer"
                              title="Remove slip"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        <div className="text-right font-bold pr-1 pl-handwritten-strong h-full flex items-center justify-end text-[13px]">
                          {formatLedgerAmount(row.amount)}
                        </div>
                      </div>
                    ) : row.kind === "UPI_SUMMARY" ? (
                      <div key={row.uuid} className="grid grid-cols-[62px_54px_1fr_92px] h-[20px] items-center">
                        <div className="text-center pr-1 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[10px] font-mono font-bold text-emerald-800">
                          UPI
                        </div>
                        <div className="text-center pl-handwritten pr-1 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[13px] text-neutral-500">
                          —
                        </div>
                        <div className="pl-3 truncate pr-2 h-full flex items-center">
                          <span className="pl-handwritten-strong text-emerald-900 truncate">{row.customer_name}</span>
                        </div>
                        <div className="text-right font-bold pr-1 pl-handwritten-strong text-emerald-900 h-full flex items-center justify-end text-[13px]">
                          {formatLedgerAmount(row.amount)}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={row.uuid}
                        className="group grid grid-cols-[62px_54px_1fr_92px] h-[20px] items-center rotate-[-0.1deg]"
                      >
                        <div className="text-center pr-1 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[10px] font-mono font-bold text-[#A33A32]">
                          {row.typeLabel}
                        </div>
                        <div className="text-center pr-1 border-r border-[#A33A32]/25 text-neutral-500 h-full flex items-center justify-center text-[11px]">
                          —
                        </div>
                        <div className="pl-3 truncate h-full flex items-center justify-between pr-1">
                          <span className="pl-handwritten-red truncate">{row.customer_name}</span>
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() => deleteIncomeMutation.mutate(row.uuid)}
                              className="opacity-0 group-hover:opacity-100 text-[#A33A32] hover:text-red-700 ml-1 no-print cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                        <div className="text-right pr-1 pl-handwritten-red h-full flex items-center justify-end text-[13px]">
                          {formatLedgerAmount(row.amount)}
                        </div>
                      </div>
                    )
                  )}

                  {/* Unified Inline Entry Row: Type (Income/Expense) -> Qty -> Particulars -> Amount */}
                  {!isLocked && (
                    <div className="pt-1 space-y-1 no-print">
                      <div className="grid grid-cols-[62px_54px_1fr_92px] h-[22px] items-center">
                        <div className="pr-1 border-r border-[#A33A32]/25 h-full flex items-center">
                          <select
                            value={leftMode}
                            onChange={(e) => setLeftMode(e.target.value as LeftEntryMode)}
                            title="Select Income / Expense / Credit / UPI / Loan"
                            className="w-full h-5 rounded border border-[#A33A32]/30 bg-white/80 px-0.5 text-[10px] font-sans font-bold text-neutral-800 outline-none"
                          >
                            <option value="CREDIT">Credit</option>
                            <option value="CASH">Cash Slip</option>
                            <option value="INC_CASH">Inc ₹</option>
                            <option value="UPI">UPI</option>
                            <option value="CARD">Card</option>
                            <option value="EXP_CASH">Exp ₹</option>
                            <option value="EXP_BANK">Exp Bk</option>
                            <option value="LEND_CASH">Loan</option>
                          </select>
                        </div>

                        <div className="pr-1 border-r border-[#A33A32]/25 h-full flex items-center">
                          <input
                            ref={leftQtyRef}
                            type="number"
                            step="0.01"
                            value={leftQty}
                            placeholder="Qty"
                            disabled={
                              leftMode === "INC_CASH" ||
                              leftMode === "EXP_CASH" ||
                              leftMode === "EXP_BANK" ||
                              leftMode === "LEND_CASH"
                            }
                            onChange={(e) => setLeftQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                leftParticularsRef.current?.focus();
                              }
                            }}
                            className="w-full h-4 bg-transparent border-b border-dashed border-[#1C2B4A]/35 text-center text-[#103F91] placeholder:text-[#103F91]/40 pl-handwritten text-[12px] outline-none focus:bg-yellow-50/70 focus:border-solid disabled:opacity-30 select-text"
                          />
                        </div>

                        <div className="pl-3 pr-1 h-full flex items-center">
                          <input
                            ref={leftParticularsRef}
                            type="text"
                            value={leftParticulars}
                            placeholder={
                              leftMode === "LEND_CASH"
                                ? "Customer name (Loan)..."
                                : leftMode === "INC_CASH"
                                ? "Cash income (Lube, Scrap)..."
                                : leftMode === "EXP_CASH" || leftMode === "EXP_BANK"
                                ? "Expense (Tea, Repair)..."
                                : "Customer / Particulars..."
                            }
                            onChange={(e) => setLeftParticulars(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                leftAmtRef.current?.focus();
                              }
                            }}
                            className={`w-full h-4 bg-transparent border-b border-dashed border-[#1C2B4A]/35 text-[12px] outline-none focus:bg-yellow-50/70 focus:border-solid select-text ${
                              leftMode.startsWith("EXP") || leftMode === "LEND_CASH"
                                ? "text-[#A33A32] pl-handwritten-red placeholder:text-[#A33A32]/45"
                                : "text-[#103F91] pl-handwritten-strong placeholder:text-[#103F91]/40"
                            }`}
                          />
                        </div>

                        <div className="pr-1 h-full flex items-center gap-1">
                          <input
                            ref={leftAmtRef}
                            type="number"
                            step="0.01"
                            value={leftAmt}
                            placeholder="₹ Amt"
                            onChange={(e) => setLeftAmt(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveLeftBookEntryMutation.mutate();
                              }
                            }}
                            className={`w-full h-4 bg-transparent border-b border-dashed border-[#1C2B4A]/35 text-right font-bold text-[12px] outline-none focus:bg-yellow-50/70 focus:border-solid select-text ${
                              leftMode.startsWith("EXP") || leftMode === "LEND_CASH"
                                ? "text-[#A33A32] pl-handwritten-red placeholder:text-[#A33A32]/45"
                                : "text-[#103F91] pl-handwritten-strong placeholder:text-[#103F91]/40"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Sub-row: Fuel + Individual UPI Handle selector + Add button */}
                      <div className="pl-[66px] pr-1 flex flex-wrap items-center gap-1.5 text-[10px] font-sans">
                        {(leftMode === "CREDIT" ||
                          leftMode === "CASH" ||
                          leftMode === "UPI" ||
                          leftMode === "CARD") && (
                          <select
                            value={leftFuel}
                            onChange={(e) => setLeftFuel(e.target.value as FuelType)}
                            className="h-5 rounded border border-[#103F91]/30 bg-white/70 px-1 text-[#103F91] font-semibold outline-none"
                          >
                            <option value="DIESEL">Diesel</option>
                            <option value="PETROL">Petrol</option>
                            <option value="SPEED">Speed</option>
                          </select>
                        )}

                        {leftMode === "UPI" && upiAccounts && upiAccounts.length > 0 && (
                          <select
                            value={leftUpiUuid}
                            onChange={(e) => {
                              const uuid = e.target.value;
                              setLeftUpiUuid(uuid);
                              const matched = upiAccounts.find((u) => u.uuid === uuid);
                              setLeftUpiBankUuid(matched?.bank_account_uuid || "");
                            }}
                            className="h-5 max-w-[180px] rounded border border-emerald-700/35 bg-white/80 px-1 text-emerald-900 font-semibold outline-none"
                          >
                            {upiAccounts.map((u) => (
                              <option key={u.uuid} value={u.uuid}>
                                {u.name} ({u.provider})
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          disabled={saveLeftBookEntryMutation.isPending}
                          onClick={() => saveLeftBookEntryMutation.mutate()}
                          className="ml-auto h-5 px-2 rounded bg-[#A33A32] text-white font-semibold hover:bg-[#8c2e27] cursor-pointer disabled:opacity-50"
                        >
                          {saveLeftBookEntryMutation.isPending ? "..." : "+ Add"}
                        </button>
                      </div>
                    </div>
                  )}
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
                          className="bg-transparent border-b border-dashed border-[#1C2B4A]/25 text-black font-bold text-center w-full h-4 outline-none hover:bg-yellow-50/50 focus:bg-yellow-50 focus:border-solid pl-handwritten text-[13px] select-text"
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
                      {(totalVouchersAndUpi + totalExpensesAmount).toLocaleString("en-IN")}
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
                      className="bg-transparent border-b border-dashed border-[#1C2B4A]/25 text-black font-bold text-right w-24 h-4 outline-none hover:bg-yellow-50/50 focus:bg-yellow-50 focus:border-solid pl-handwritten text-[13px] select-text"
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
                      className="bg-transparent border-b border-dashed border-[#1C2B4A]/25 text-black font-bold text-right w-24 h-4 outline-none hover:bg-yellow-50/50 focus:bg-yellow-50 focus:border-solid pl-handwritten text-[13px] select-text"
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
                RIGHT PAGE: EDITABLE OPENING / CLOSING / NET + CASH INCOME / LOAN
               ======================================================== */}
            <div className="pl-register-page-right flex flex-col select-none">
              <div
                onClick={() => triggerPageTurn("next")}
                className="pl-page-corner-right no-print"
                title="Click to turn to next page/day"
              />

              <div className="pl-register-page-header">
                <div className="text-center flex-1 flex flex-col items-center">
                  <span className="pl-handwritten-header pl-handwritten-red tracking-widest font-bold">
                    Nozzle Readings &amp; Fuel Reconciliation
                  </span>
                  <div className="text-[10px] font-mono font-bold inline-block px-4 text-neutral-800">
                    {formattedDateHeader}{" "}
                    <span className="text-[9px] text-neutral-500 font-normal no-print">
                      (Opening / Closing / Net editable · Enter jumps across row)
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
                        <div className="absolute -left-[68px] top-0 w-[64px] text-right pl-handwritten-strong font-bold text-[#A33A32] text-[11px] h-[80px] flex flex-col justify-center items-end select-none z-20 leading-tight">
                          <span>{dispName}</span>
                          <span className="text-[9px] font-normal text-neutral-500">Open / Close / Net</span>
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

                        {/* Row 2 (Upper): Editable Opening Readings */}
                        <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten text-[#103F91]">
                          {dispNozzles.map((noz) => (
                            <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center px-1">
                              <input
                                ref={(el) => {
                                  openingInputRefs.current[noz.idx] = el;
                                }}
                                type="number"
                                step="0.01"
                                disabled={isLocked}
                                value={noz.opening_str}
                                placeholder="Opening"
                                title="Opening reading (Enter → next nozzle opening)"
                                onChange={(e) =>
                                  handleNozzleFieldChange(
                                    noz.nozzle_uuid,
                                    "opening",
                                    e.target.value,
                                    noz.opening_reading,
                                    noz.meter_capacity
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  const nextEl = openingInputRefs.current[noz.idx + 1];
                                  if (nextEl) {
                                    nextEl.focus();
                                    nextEl.select();
                                  }
                                }}
                                className="w-full max-w-[92px] h-4 bg-transparent border-b border-dashed border-[#103F91]/25 text-center text-[#103F91] outline-none focus:bg-yellow-50/70 focus:border-solid pl-handwritten text-[12px] select-text"
                              />
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                            <div key={`ph3-${i}`} className="h-full" />
                          ))}
                        </div>

                        {/* Optional Row: 6 AM Interim Reading */}
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
                                    handleNozzleFieldChange(
                                      noz.nozzle_uuid,
                                      "interim6am",
                                      e.target.value,
                                      noz.opening_reading,
                                      noz.meter_capacity
                                    )
                                  }
                                  className="w-full max-w-[92px] h-4 bg-transparent border-b border-dashed border-[#A33A32]/40 text-center text-[#A33A32] outline-none focus:bg-yellow-50/70 text-[11px] select-text"
                                />
                              </div>
                            ))}
                            {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                              <div key={`ph6-${i}`} className="h-full" />
                            ))}
                          </div>
                        )}

                        {/* Row 3 (Below Opening): Editable Closing Readings */}
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
                                title="Closing reading (Enter → next nozzle closing)"
                                onChange={(e) =>
                                  handleNozzleFieldChange(
                                    noz.nozzle_uuid,
                                    "closing",
                                    e.target.value,
                                    noz.opening_reading,
                                    noz.meter_capacity
                                  )
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
                                className="w-full max-w-[92px] h-4 bg-transparent border-b border-dashed border-[#103F91]/40 text-center text-[#103F91] font-bold outline-none focus:bg-yellow-50/70 focus:border-solid pl-handwritten-strong text-[13px] select-text"
                              />
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 4 - dispNozzles.length) }).map((_, i) => (
                            <div key={`ph2-${i}`} className="h-full" />
                          ))}
                        </div>

                        {/* Row 4: Editable Net Liters Sold */}
                        <div className="grid grid-cols-4 h-[20px] items-center text-center pl-handwritten-strong text-[#103F91] font-bold">
                          {dispNozzles.map((noz) => (
                            <div key={noz.nozzle_uuid} className="h-full flex items-center justify-center px-1">
                              <input
                                ref={(el) => {
                                  netInputRefs.current[noz.idx] = el;
                                }}
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={isLocked}
                                value={noz.net_str}
                                placeholder="Net L"
                                title="Net liters sold — typing Net auto-computes Closing!"
                                onChange={(e) =>
                                  handleNozzleFieldChange(
                                    noz.nozzle_uuid,
                                    "net",
                                    e.target.value,
                                    noz.opening_reading,
                                    noz.meter_capacity
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  const nextEl = netInputRefs.current[noz.idx + 1];
                                  if (nextEl) {
                                    nextEl.focus();
                                    nextEl.select();
                                  } else if (!isLocked && !saveReadingsMutation.isPending) {
                                    saveReadingsMutation.mutate();
                                  }
                                }}
                                className="w-full max-w-[92px] h-4 bg-transparent border-b border-dashed border-[#103F91]/40 text-center text-emerald-800 font-bold outline-none focus:bg-yellow-50/70 focus:border-solid pl-handwritten-strong text-[12px] select-text"
                              />
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
                  { label: "H.S.D", fuelKey: "DIESEL" as const, summary: hsdSummary, rate: hsdRate, amt: hsdAmt },
                  { label: "M.S", fuelKey: "PETROL" as const, summary: msSummary, rate: msRate, amt: msAmt },
                  { label: "Speed", fuelKey: "SPEED" as const, summary: speedSummary, rate: msRate2, amt: speedAmt },
                ].map(({ label, fuelKey, summary, rate, amt }) => (
                  <div
                    key={label}
                    className="flex items-center h-[20px] pl-handwritten text-[#103F91] text-[13px]"
                  >
                    <span className="font-bold text-[#A33A32] w-[50px] shrink-0">{label}</span>
                    <span className="pl-1">= {summary.rawQty.toLocaleString()}</span>
                    <span className="pl-1 inline-flex items-center">
                      -{" "}
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={isLocked}
                        value={summary.testing || ""}
                        placeholder="0"
                        title="Testing liters (editable)"
                        onChange={(e) => updateFuelTesting(fuelKey, e.target.value)}
                        className="w-10 h-4 mx-0.5 bg-transparent border-b border-dashed border-[#103F91]/40 text-center text-[#103F91] font-semibold outline-none focus:bg-yellow-50/70 focus:border-solid text-[12px] select-text"
                      />
                    </span>
                    <span className="pl-1">= {summary.netVol.toLocaleString()} L</span>
                    <span className="text-[#A33A32] pl-1">× {rate}</span>
                    <span className="ml-auto font-bold pl-handwritten-strong text-[13px] pr-1">
                      {formatLedgerAmount(amt)}
                    </span>
                  </div>
                ))}

                <div className="h-[20px]" />

                {/* Cash Income, Recoveries & Inline Cash Income / Money Lended */}
                <div className="border-t border-[#A33A32]/30">
                  {activeVouchers
                    .filter((row) => row.paymentMode === "CASH")
                    .map((row) => (
                      <div key={row.uuid} className="flex items-center h-[20px] pl-handwritten text-[12px]">
                        <span className="truncate flex-1 pr-2">{row.customer_name} [CASH]</span>
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
                            onClick={() => deleteIncomeMutation.mutate(row.uuid)}
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

                  {/* Inline Right-Page Cash Income / Money Lended Entry */}
                  {!isLocked && (
                    <div className="flex items-center gap-1.5 h-[24px] pl-handwritten text-[12px] no-print">
                      <select
                        value={rightMode}
                        onChange={(e) => setRightMode(e.target.value as RightEntryMode)}
                        className="h-5 rounded border border-[#103F91]/30 bg-white/70 px-1 text-[10px] font-sans font-semibold text-[#103F91] outline-none"
                      >
                        <option value="INCOME">+ Cash Income</option>
                        <option value="LEND_CASH">− Money Lended</option>
                      </select>
                      <input
                        ref={rightDescRef}
                        type="text"
                        value={rightDesc}
                        placeholder={
                          rightMode === "LEND_CASH"
                            ? "Customer name (Money lended)..."
                            : "Lube, Scrap, Misc income..."
                        }
                        onChange={(e) => setRightDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            rightAmtRef.current?.focus();
                          }
                        }}
                        className={`flex-1 h-4 bg-transparent border-b border-dashed border-[#103F91]/35 text-[12px] outline-none focus:bg-yellow-50/70 focus:border-solid select-text ${
                          rightMode === "LEND_CASH"
                            ? "text-[#A33A32] pl-handwritten-red placeholder:text-[#A33A32]/45"
                            : "text-[#103F91] pl-handwritten placeholder:text-[#103F91]/45"
                        }`}
                      />
                      <input
                        ref={rightAmtRef}
                        type="number"
                        value={rightAmt}
                        placeholder="₹ Amt"
                        onChange={(e) => setRightAmt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveRightBookEntryMutation.mutate();
                          }
                        }}
                        className="w-20 h-4 bg-transparent border-b border-dashed border-[#103F91]/35 text-right text-[#103F91] placeholder:text-[#103F91]/45 pl-handwritten-strong font-bold text-[12px] outline-none focus:bg-yellow-50/70 focus:border-solid select-text"
                      />
                      {rightDesc && rightAmt && (
                        <button
                          type="button"
                          disabled={saveRightBookEntryMutation.isPending}
                          onClick={() => saveRightBookEntryMutation.mutate()}
                          className="text-[#103F91] font-bold text-xs cursor-pointer"
                          title="Save"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-[20px]" />

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
