import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/common/PageHeader";
import { ChevronLeft, ChevronRight, Printer, RefreshCw, AlertCircle } from "lucide-react";
import { useVoucherList } from "@/features/vouchers/hooks/useVoucherList";
import voucherService from "@/features/vouchers/services/voucherService";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import inventoryService from "@/features/inventory/services/inventoryService";

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
  const base = Math.floor(val);
  const paise = Math.round((val - base) * 100);
  const paiseStr = paise === 0 ? "00" : paise.toString().padStart(2, "0");
  return `${base.toLocaleString("en-IN")}=${paiseStr}`;
}

export default function RegisterPage() {
  const { activePump } = useCurrentUser();
  const queryClient = useQueryClient();
  const stationName = activePump?.name || "Shree Petroleum";
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]); // Opens to the current day
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const swipeStartX = useRef<number | null>(null);

  // Local state for cash denominations, cached to localStorage per date
  const cacheKey = `ledger_denominations_${date}`;
  const DEFAULT_NOTES = { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0 };

  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [cashHome, setCashHome] = useState(0);
  const [prevDeposit, setPrevDeposit] = useState(0);
  const [ledgerInterest, setLedgerInterest] = useState(0);

  // Load cash denomination cache on date changes
  useEffect(() => {
    const saved = localStorage.getItem(cacheKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNotes(parsed.notes || DEFAULT_NOTES);
        setCashHome(parsed.cashHome ?? 0);
        setPrevDeposit(parsed.prevDeposit ?? 0);
        setLedgerInterest(parsed.ledgerInterest ?? 0);
      } catch (e) {
        console.error("Failed to parse denominations", e);
      }
    } else {
      setNotes(DEFAULT_NOTES);
      setCashHome(0);
      setPrevDeposit(0);
      setLedgerInterest(0);
    }
  }, [date, cacheKey]);

  // Save cache helper
  const saveDenominations = (updatedNotes: typeof notes, updatedHome = cashHome, updatedDeposit = prevDeposit, updatedInterest = ledgerInterest) => {
    localStorage.setItem(
      cacheKey,
      JSON.stringify({ notes: updatedNotes, cashHome: updatedHome, prevDeposit: updatedDeposit, ledgerInterest: updatedInterest })
    );
  };

  // Queries for live Vouchers and Nozzle Meter readings
  const { data: vouchersData, refetch: refetchVouchers } = useVoucherList({
    from_date: date,
    to_date: date,
  });

  const { data: nozzleData, refetch: refetchNozzles } = useQuery({
    queryKey: ["nozzleReadingsBulkForm", date],
    queryFn: () => inventoryService.getBulkReadingsForm(date),
  });

  const dateObject = new Date(date);
  const formattedDateHeader = dateObject.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");

  // Page turning handler — a single sheet turns over the spine; the day's spread
  // swaps underneath at the mid-point, while the sheet is edge-on and hidden.
  function triggerPageTurn(dir: "next" | "prev") {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipDirection(dir);

    setTimeout(() => {
      if (dir === "next") {
        if (currentPageIndex < totalPages - 1) {
          setPageIndex(currentPageIndex + 1);
        } else {
          const d = new Date(date);
          d.setDate(d.getDate() + 1);
          setDate(d.toISOString().split("T")[0]);
          setPageIndex(0);
        }
      } else {
        if (currentPageIndex > 0) {
          setPageIndex(currentPageIndex - 1);
        } else {
          const d = new Date(date);
          d.setDate(d.getDate() - 1);
          setDate(d.toISOString().split("T")[0]);
          setPageIndex(999); // 999 clamps to the last page of the previous date
        }
      }
    }, 350);

    setTimeout(() => {
      setIsFlipping(false);
      setFlipDirection(null);
    }, 700); // matches flip keyframe duration
  }



  // Speculative prefetching: keep a 30-day sliding window of surrounding dates pre-fetched
  // in the background cache so page turns resolve instantaneously.
  useEffect(() => {
    const baseDate = new Date(date);
    // Prefetch ±15 days around the current date
    const prefetchOffsets = Array.from({ length: 30 }, (_, index) => index - 15).filter(offset => offset !== 0);

    const timer = setTimeout(() => {
      prefetchOffsets.forEach(offset => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + offset);
        const targetDateStr = d.toISOString().split("T")[0];

        // Prefetch vouchers
        queryClient.prefetchQuery({
          queryKey: ["vouchers", { from_date: targetDateStr, to_date: targetDateStr }],
          queryFn: () => voucherService.getVouchers({ from_date: targetDateStr, to_date: targetDateStr }),
          staleTime: 5 * 60 * 1000,
        });

        // Prefetch nozzle readings bulk-form
        queryClient.prefetchQuery({
          queryKey: ["nozzleReadingsBulkForm", targetDateStr],
          queryFn: () => inventoryService.getBulkReadingsForm(targetDateStr),
          staleTime: 5 * 60 * 1000,
        });
      });
    }, 100); // Small delay to prioritize the immediate layout queries

    return () => clearTimeout(timer);
  }, [date, queryClient]);

  // Swipe left → next day, swipe right → previous day (touch + mouse drag).
  function onSwipeStart(e: React.PointerEvent) {
    swipeStartX.current = e.clientX;
  }
  function onSwipeEnd(e: React.PointerEvent) {
    if (swipeStartX.current === null) return;
    const dx = e.clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(dx) < 50) return; // ignore taps / tiny drags
    triggerPageTurn(dx < 0 ? "next" : "prev");
  }

  // Fallback Mock data for Vouchers (English ONLY) matching reference photo
  const MOCK_VOUCHERS: any[] = [];

  const MOCK_EXPENSES: any[] = [];

  // Map vouchers
  const activeVouchers = vouchersData?.items?.length ? vouchersData.items.map(v => ({
    // API serializes Decimal as strings — coerce so .toFixed/arithmetic work.
    quantity_liters: Number(v.quantity_liters ?? 0),
    customer_name: (v.customer_name || "Cash Customer") +
                   (v.vehicle_number ? ` (${v.vehicle_number})` : "") +
                   (v.payment_mode ? ` [${v.payment_mode}]` : ""),
    amount: Number(v.total_amount ?? 0)
  })) : MOCK_VOUCHERS;

  const totalVouchersAmount = activeVouchers.reduce((sum, item) => sum + item.amount, 0);

  // Left page ordering: Credit customers first, then UPI, then Card, then
  // everything else (cash). Expenses are rendered as their own last section.
  const paymentRank = (name: string) =>
    /\[CREDIT\]/i.test(name) ? 0 : /\[UPI\]/i.test(name) ? 1 : /\[CARD\]/i.test(name) ? 2 : 3;
  const sortedVouchers = [...activeVouchers].sort(
    (a, b) => paymentRank(a.customer_name) - paymentRank(b.customer_name)
  );

  // Multi-sheet pagination per date (14 rows fit per ledger sheet)
  const ROWS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(sortedVouchers.length / ROWS_PER_PAGE));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const visibleVouchers = sortedVouchers.slice(
    currentPageIndex * ROWS_PER_PAGE,
    (currentPageIndex + 1) * ROWS_PER_PAGE
  );

  // Cash Calculation Cascade — one row per denomination, summed for the total
  const totalCashCounted = DENOMINATIONS.reduce((sum, d) => sum + notes[d.key] * d.value, 0);

  // Grand Total Cascade (Left page bottom right)
  const grandTotalLeft = totalCashCounted + totalVouchersAmount + cashHome + prevDeposit;

  // Load Daily Fuel Testing defaults from localStorage (synced with Meter Readings tab)
  const DEFAULT_FUEL_TESTING: Record<string, number> = { DIESEL: 70, PETROL: 5, SPEED: 0 };
  const [fuelTestingMap, setFuelTestingMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("default_fuel_testing");
      return saved ? JSON.parse(saved) : DEFAULT_FUEL_TESTING;
    } catch {
      return DEFAULT_FUEL_TESTING;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("default_fuel_testing");
      if (saved) setFuelTestingMap(JSON.parse(saved));
    } catch {}
  }, [date]);

  // Nozzle Grid fallbacks matching image
  const MOCK_NOZZLES: any[] = [];

  // Map Nozzles — Number() coerces Decimal fields that the API serializes as
  // strings, so the reading arithmetic below stays numeric.
  const activeNozzles = nozzleData?.items?.length ? nozzleData.items.map(item => {
    const defaultTest = fuelTestingMap[item.fuel_type] ?? 0;
    const testingVal = item.testing != null && Number(item.testing) > 0 ? Number(item.testing) : defaultTest;
    return {
      nozzle_name: item.nozzle_name,
      dispenser_name: item.dispenser_name,
      fuel_type: item.fuel_type,
      opening_reading: Number(item.opening_reading) || 0,
      closing_reading: item.closing_reading != null ? Number(item.closing_reading) : null,
      testing: testingVal,
    };
  }) : MOCK_NOZZLES;

  // Calculate grid sales
  const gridItems = activeNozzles.map((noz, index) => {
    const hasClosing = noz.closing_reading != null;
    const rawSales = hasClosing ? Math.max(0, noz.closing_reading! - noz.opening_reading) : 0;
    const netVol = hasClosing ? Math.max(0, rawSales - noz.testing) : 0;
    // Cumulative meter logic simulation
    const cumulative = 3316910 + (index * 2840518) + (netVol * 12);
    const previous = cumulative - netVol;
    // Use the real dispenser name from the readings API; fall back to fuel type
    const dispenser_name = noz.dispenser_name || (noz.fuel_type === "DIESEL" ? "HSD I" : "MS I");
    return {
      ...noz,
      hasClosing,
      dispenser_name,
      rawSales,
      netVol,
      cumulative,
      previous,
    };
  });

  // Group nozzle items by dispenser name (HSD I, MS I)
  const groupedDispensers: Record<string, typeof gridItems> = {};
  gridItems.forEach(item => {
    const disp = item.dispenser_name;
    if (!groupedDispensers[disp]) {
      groupedDispensers[disp] = [];
    }
    groupedDispensers[disp].push(item);
  });

  // Aggregate per fuel type: total raw qty, testing, net volume
  const fuelTypeSummary = gridItems.reduce((acc, item) => {
    const fuel = item.fuel_type;
    if (!acc[fuel]) acc[fuel] = { rawQty: 0, testing: 0, netVol: 0 };
    acc[fuel].rawQty += item.rawSales;
    acc[fuel].testing += item.testing;
    acc[fuel].netVol += item.netVol;
    return acc;
  }, {} as Record<string, { rawQty: number; testing: number; netVol: number }>);

  const hsdSummary = fuelTypeSummary["DIESEL"] || { rawQty: 0, testing: fuelTestingMap["DIESEL"] ?? 70, netVol: 0 };
  const msSummary = fuelTypeSummary["PETROL"] || { rawQty: 0, testing: fuelTestingMap["PETROL"] ?? 5, netVol: 0 };
  // Speed fuel type — if present in the data, otherwise zero
  const speedSummary = fuelTypeSummary["SPEED"] || { rawQty: 0, testing: fuelTestingMap["SPEED"] ?? 0, netVol: 0 };

  // Fuel rate constants (₹ per liter)
  const hsdRate = 98.39;
  const msRate = 113.35;
  const msRate2 = 123.00;

  const hsdAmt = hsdSummary.netVol * hsdRate;
  const msAmt = msSummary.netVol * msRate;
  const speedAmt = speedSummary.netVol * msRate2;

  const totalCalculatedFuelSales = hsdAmt + msAmt + speedAmt;
  const grandTotalRight = totalCalculatedFuelSales + ledgerInterest + prevDeposit;

  return (
    <div className="space-y-6 print-container">
      {/* Action bar (Hidden on prints) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <PageHeader
          title="Daily Register"
          description="Handwritten ledger style daily sheet replicating the physical register book."
        />

        <div className="flex flex-wrap items-center gap-3">
          {/* Refresh queries */}
          <button
            onClick={() => {
              refetchVouchers();
              refetchNozzles();
            }}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-hairline bg-surface-2 text-ink hover:bg-surface-3 transition cursor-pointer"
            title="Reload Data"
          >
            <RefreshCw size={14} />
          </button>

          {/* Date Picker switcher */}
          <div className="flex bg-surface-2 border border-hairline p-1 rounded-xl">
            <button
              onClick={() => triggerPageTurn("prev")}
              disabled={isFlipping}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-3 text-ink transition disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPageIndex(0);
              }}
              className="bg-transparent text-xs font-mono font-bold text-ink outline-none px-3 text-center border-none focus:ring-0 w-28 cursor-pointer"
            />
            <button
              onClick={() => triggerPageTurn("next")}
              disabled={isFlipping}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-3 text-ink transition disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-3 transition cursor-pointer"
          >
            <Printer size={14} /> Print Register
          </button>
        </div>
      </div>



      {/* Real bound book container */}
      <div className="pl-register-container overflow-x-auto min-w-[768px]">
        
        {/* Book Outer Spine layout */}
        <div
          className="pl-book-shell relative min-w-[1000px] w-full max-w-[1250px] mx-auto min-h-[820px] rounded-2xl overflow-hidden border border-amber-950/30 touch-pan-y"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
        >
          {/* Interactive page margins / stacked page edges for book navigation */}
          {/* Left Stacked Page Edges (Clickable area to go back) */}
          <div
            onClick={() => triggerPageTurn("prev")}
            className="absolute left-0 top-0 bottom-0 w-[48px] z-40 cursor-pointer group hover:bg-black/[0.03] transition-all duration-300 flex items-center justify-start pl-3 no-print"
            title="Click to turn to previous day"
          >
            {/* Layered page edge lines (visual stack of paper on left margin) */}
            <div className="absolute left-0 inset-y-0 w-[12px] flex pointer-events-none">
              <div className="w-[3px] h-full bg-[#e7dcc2] border-r border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#efe6d0] border-r border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#faf6ee] border-r border-[#c4b391]/30" />
            </div>
            {/* Animated chevron indicator */}
            <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 bg-white/90 p-2.5 rounded-full shadow-lg border border-[#e5dac3] text-black ml-1.5 flex items-center justify-center">
              <ChevronLeft size={18} />
            </div>
          </div>

          {/* Right Stacked Page Edges (Clickable area to go forward) */}
          <div
            onClick={() => triggerPageTurn("next")}
            className="absolute right-0 top-0 bottom-0 w-[48px] z-40 cursor-pointer group hover:bg-black/[0.03] transition-all duration-300 flex items-center justify-end pr-3 no-print"
            title="Click to turn to next day"
          >
            {/* Layered page edge lines (visual stack of paper on right margin) */}
            <div className="absolute right-0 inset-y-0 w-[12px] flex justify-end pointer-events-none">
              <div className="w-[3px] h-full bg-[#faf6ee] border-l border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#efe6d0] border-l border-[#c4b391]/30" />
              <div className="w-[3px] h-full bg-[#e7dcc2] border-l border-[#c4b391]/30" />
            </div>
            {/* Animated chevron indicator */}
            <div className="opacity-0 group-hover:opacity-100 group-hover:-translate-x-1 transition-all duration-300 bg-white/90 p-2.5 rounded-full shadow-lg border border-[#e5dac3] text-black mr-1.5 flex items-center justify-center">
              <ChevronRight size={18} />
            </div>
          </div>

          <div className="grid grid-cols-2 relative bg-[#F7F1E3] min-h-[820px]">

            {/* 3D Double-Sided Flipbook sheet turning over the spine */}
            {isFlipping && (
              <div className={`pl-flip-container ${flipDirection === "next" ? "pl-flip-next" : "pl-flip-prev"}`}>
                {/* Front side of turning page */}
                <div className="pl-flip-page-front">
                  <div className="pl-flip-mock-content space-y-4 font-handwritten">
                    <div className="border-b border-[#A33A32]/25 pb-1">
                      <div className="grid grid-cols-[65px_1fr_95px] font-bold text-[#A33A32] text-xs">
                        <span>Qty (L)</span>
                        <span>Particulars / Accounts</span>
                        <span className="text-right">Amount (₹)</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="grid grid-cols-[65px_1fr_95px] items-center py-0.5"><span className="text-neutral-500">152.45</span><span className="font-bold">C. Monu Bhadup</span><span className="text-right font-bold">15,000=00</span></div>
                      <div className="grid grid-cols-[65px_1fr_95px] items-center py-0.5"><span className="text-neutral-500">142.59</span><span className="font-bold">C. Monu Bhadup</span><span className="text-right font-bold">14,000=00</span></div>
                      <div className="grid grid-cols-[65px_1fr_95px] items-center py-0.5"><span className="text-neutral-500">13.48</span><span className="font-bold">C. Triji M. Gas</span><span className="text-right font-bold">1,326=30</span></div>
                      <div className="grid grid-cols-[65px_1fr_95px] items-center py-0.5"><span className="text-neutral-500">508.18</span><span className="font-bold">C. Ubheg Chobhari</span><span className="text-right font-bold text-neutral-800">50,000=00</span></div>
                      <div className="grid grid-cols-[65px_1fr_95px] items-center py-0.5"><span className="text-neutral-500">1501.83</span><span className="font-bold">Paytm Settlement</span><span className="text-right font-bold">1,47,765=70</span></div>
                    </div>
                  </div>
                </div>

                {/* Back side of turning page */}
                <div className="pl-flip-page-back">
                  <div className="pl-flip-mock-content space-y-4 font-handwritten">
                    <div className="space-y-4 text-xs">
                      <div>
                        <div className="font-bold text-blue-900">H.S.D Dispenser Logs</div>
                        <div className="border-b border-[#A33A32]/25 mb-1" />
                        <div className="grid grid-cols-2 text-center font-bold">
                          <span>Nozzle 1</span>
                          <span>Nozzle 2</span>
                        </div>
                        <div className="grid grid-cols-2 text-center text-neutral-600">
                          <span>Closing: 5129</span>
                          <span>Closing: 13846</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-blue-900">M.S Dispenser Logs</div>
                        <div className="border-b border-[#A33A32]/25 mb-1" />
                        <div className="grid grid-cols-2 text-center font-bold">
                          <span>Nozzle 1</span>
                          <span>Nozzle 2</span>
                        </div>
                        <div className="grid grid-cols-2 text-center text-neutral-600">
                          <span>Closing: 12950</span>
                          <span>Closing: 3092</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Central spine fold crease */}
            <div className="absolute inset-y-0 left-1/2 -ml-2.5 w-5 bg-gradient-to-r from-black/10 via-black/30 to-black/10 z-30 pointer-events-none border-l border-r border-black/5" />

            {/* ========================================================
                LEFT PAGE: VOUCHERS LEDGER & CASH CASCADE
                ======================================================= */}
            <div className="pl-register-page-left flex flex-col justify-between select-none">
              {/* Dog-ear corner fold (Clickable area to go back) */}
              <div
                onClick={() => triggerPageTurn("prev")}
                className="pl-page-corner-left no-print"
                title="Click to turn to previous day"
              />
              
              {/* Header Title Section (Sitting inside 80px solid top margin) */}
              <div className="pl-register-page-header">
                <div className="text-[10px] leading-3.5 text-neutral-700 rotate-[-0.5deg]">
                  {/* Empty left margin slot */}
                </div>

                <div className="text-center flex-1 pr-6 flex flex-col items-center">
                  <span className="pl-handwritten-header pl-handwritten-red tracking-widest font-bold">
                    {stationName} — Daily Register
                  </span>
                  <div className="text-[10px] font-mono font-bold inline-block px-4 select-all text-neutral-800">
                    {formattedDateHeader}{totalPages > 1 ? ` (Sheet ${currentPageIndex + 1} of ${totalPages})` : ""}
                  </div>
                </div>
              </div>

              {/* Transactions grid (No horizontal border lines between individual cells, just blue ruled lines) */}
              <div className="text-xs space-y-0 flex-1">
                {/* Column Titles (Muted red structural headers) */}
                <div className="grid grid-cols-[65px_1fr_95px] border-b-2 border-[#A33A32] pl-handwritten-red font-bold h-[20px] items-center">
                  <div className="text-center pr-2 border-r border-[#A33A32]/25">Qty (L)</div>
                  <div className="pl-4">Particulars / Customer Accounts</div>
                  <div className="text-right">Amount (₹)</div>
                </div>

                {/* Vouchers Row Iterations (Adjusted to h-[20px] matching 20px gap) */}
                <div className="space-y-[0px]">
                  {visibleVouchers.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[65px_1fr_95px] h-[20px] items-center">
                      
                      {/* Qty liters column (on left of red line) */}
                      <div className="text-center pl-handwritten pr-2 border-r border-[#A33A32]/25 h-full flex items-center justify-center text-[13px]">
                        {row.quantity_liters > 0 ? row.quantity_liters.toFixed(2) : "—"}
                      </div>
                      
                      {/* Customer Name column - primary handwritten blue-black */}
                      <div className="pl-4 truncate pr-2 h-full flex items-center">
                        <span className="pl-handwritten-strong">
                          {row.customer_name}
                        </span>
                      </div>
                      
                      {/* Amount in Indian Ledger Format */}
                      <div className="text-right font-bold pr-1 pl-handwritten-strong h-full flex items-center justify-end text-[13px]">
                        {formatLedgerAmount(row.amount)}
                      </div>

                    </div>
                  ))}

                  {/* Expense Items in bottom list area (English only - red ink highlight) */}
                  {MOCK_EXPENSES.map((row, idx) => (
                    <div key={`exp-${idx}`} className="grid grid-cols-[65px_1fr_95px] h-[20px] items-center rotate-[-0.2deg]">
                      <div className="text-center pr-2 border-r border-[#A33A32]/25 text-neutral-500 h-full flex items-center justify-center">—</div>
                      <div className="pl-4 truncate h-full flex items-center">
                        <span className="pl-handwritten-red">
                          {row.customer_name}
                        </span>
                      </div>
                      <div className="text-right pr-1 pl-handwritten-red h-full flex items-center justify-end text-[13px]">{formatLedgerAmount(row.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Cash Denomination Breakdown */}
              <div className="mt-2 border-t-2 border-[#A33A32]/50 pt-2 grid grid-cols-[1.25fr_1fr] gap-4 text-[#2B2621]">
                
                {/* Interactive denominations list */}
                <div className="border-r border-[#A33A32]/25 pr-3 text-[11px] leading-5 rotate-[-0.5deg]">
                  <div className="border-b border-[#A33A32]/25 mb-1 text-[12px] pl-handwritten-red font-bold">Cash Collection Counts</div>
                  
                  {/* Fixed grid per row (denom · × · count · = · total) so wide
                      amounts can't drift or overlap like the old flex layout did */}
                  <div className="space-y-[0px] pl-handwritten">
                    {DENOMINATIONS.map(({ value, key }) => (
                      <div key={key} className="grid grid-cols-[34px_10px_1fr_10px_auto] items-center gap-1 h-[20px]">
                        <span className="text-right">{value}</span>
                        <span className="text-center">×</span>
                        <input
                          type="number"
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
                    {/* Denominations total */}
                    <div className="grid grid-cols-[34px_10px_1fr_10px_auto] items-center gap-1 h-[20px] border-t border-[#A33A32]/30 font-bold">
                      <span className="col-span-4 text-right pr-1 text-[#A33A32]">Total</span>
                      <span className="pl-handwritten-strong text-neutral-900 text-[13px] text-right min-w-[64px]">
                        {totalCashCounted.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ledger balances cascade — fixed 2-col grid (label · value) so
                    long labels can't wrap into the value and overlap it */}
                <div className="flex flex-col justify-end text-[11px] leading-4 select-none pl-1 font-handwritten">
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 h-[20px]">
                    <span className="truncate">Cash Collection:</span>
                    <span className="pl-handwritten-strong font-bold text-neutral-800 text-[13px] text-right">{totalCashCounted.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 border-b border-[#A33A32]/25 h-[20px]">
                    <span className="text-[#A33A32] truncate">Credit Collections:</span>
                    <span className="pl-handwritten-strong font-bold text-neutral-800 text-[13px] text-right">{totalVouchersAmount.toLocaleString("en-IN")}</span>
                  </div>

                  {/* Editable Cash Home */}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 h-[20px]">
                    <span className="truncate">Cash Sent Home:</span>
                    <input
                      type="number"
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

                  {/* Editable Deposited Balances */}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 border-b border-[#A33A32]/20 h-[20px]">
                    <span className="truncate">Deposited Balance:</span>
                    <input
                      type="number"
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

                  {/* Left Grand Total */}
                  <div className="grid grid-cols-[1fr_auto] items-center gap-1 font-bold text-red-800 border-t-2 border-double border-[#A33A32]/50 h-[20px]">
                    <span className="pl-handwritten-red truncate">Grand Total:</span>
                    <span className="pl-handwritten-strong underline decoration-double decoration-[#A33A32] text-neutral-900 text-[13px] text-right">{grandTotalLeft.toLocaleString("en-IN")}</span>
                  </div>
                </div>

              </div>

            </div>

            {/* ========================================================
                RIGHT PAGE: NOZZLE METER LOGS & RECONCILIATION MATH
                ======================================================== */}
            <div className="pl-register-page-right flex flex-col select-none">
              {/* Dog-ear corner fold (Clickable area to go forward) */}
              <div
                onClick={() => triggerPageTurn("next")}
                className="pl-page-corner-right no-print"
                title="Click to turn to next day"
              />
              
              {/* Header dates (Sitting inside 80px solid top margin) */}
              <div className="pl-register-page-header">
                <div className="text-center flex-1 flex flex-col items-center">
                  <span className="pl-handwritten-header pl-handwritten-red tracking-widest font-bold">
                    Nozzle Readings & Fuel Reconciliation
                  </span>
                  <div className="text-[10px] font-mono font-bold inline-block px-4 select-all text-neutral-800">{formattedDateHeader}</div>
                </div>
              </div>

              {/* Nozzle readings — 4 equal columns spanning from double red line to right page edge */}
              <div className="text-[12px] relative mt-[0px]">
                
                {Object.entries(groupedDispensers).map(([dispName, dispNozzles], dispIdx, arr) => {
                  const rows: { fn: (n: (typeof dispNozzles)[number]) => string; cls: string }[] = [
                    { fn: (n) => n.nozzle_name, cls: "pl-handwritten-strong text-[#103F91] font-bold" },
                    { fn: (n) => n.hasClosing && n.closing_reading != null ? n.closing_reading.toLocaleString() : "—", cls: "pl-handwritten-strong text-[#103F91] font-bold" },
                    { fn: (n) => n.opening_reading > 0 ? n.opening_reading.toLocaleString() : "—", cls: "pl-handwritten text-[#103F91]" },
                    { fn: (n) => n.hasClosing ? `${n.rawSales.toLocaleString()} L` : "—", cls: "pl-handwritten-strong text-[#103F91] font-bold" },
                  ];
                  return (
                    <React.Fragment key={dispName}>
                      <div className="relative">
                        {/* Dispenser name in the left margin */}
                        <div className="absolute -left-[68px] top-0 w-[64px] text-right pl-handwritten-strong font-bold text-[#A33A32] text-[11px] h-[80px] flex items-center justify-end select-none z-20">
                          {dispName}
                        </div>

                        {/* 4 data rows stacked directly: nozzle name / closing / opening / difference — no gaps, no column borders */}
                        {rows.map(({ fn, cls }, rIdx) => (
                          <div key={rIdx} className={`grid grid-cols-4 h-[20px] items-center text-center ${cls}`}>
                            {dispNozzles.map((noz, nIdx) => (
                              <div key={nIdx} className="h-full flex items-center justify-center">
                                {fn(noz)}
                              </div>
                            ))}
                            {/* Empty placeholder cells for dispensers with < 4 nozzles */}
                            {Array.from({ length: 4 - dispNozzles.length }).map((_, i) => (
                              <div key={`ph-${i}`} className="h-full" />
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* One blank ruled-line gap after the difference row (separator before next dispenser) */}
                      {dispIdx < arr.length - 1 && (
                        <div className="h-[20px]" />
                      )}
                    </React.Fragment>
                  );
                })}
                
              </div>

              {/* ─── Fuel type calculation equations ─── */}
              <div className="pr-8">
                {/* Gap line after readings */}
                <div className="h-[20px]" />

                {/* Fuel calculation rows: TYPE = QTY - Testing = Net × Rate ... Amount */}
                {[
                  { label: "H.S.D", summary: hsdSummary, rate: hsdRate, amt: hsdAmt },
                  { label: "M.S",   summary: msSummary,  rate: msRate,  amt: msAmt },
                  { label: "Speed", summary: speedSummary, rate: msRate2, amt: speedAmt },
                ].map(({ label, summary, rate, amt }) => (
                  <div key={label} className="flex items-center h-[20px] pl-handwritten text-[#103F91] text-[13px]">
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

                {/* Gap before incomes */}
                <div className="h-[20px]" />

                {/* ─── Income entries (cash only — exclude credit and UPI/card payments) ─── */}
                <div className="border-t border-[#A33A32]/30">
                  {activeVouchers
                    .filter(row => !/\[(CREDIT|UPI|CARD)\]/i.test(row.customer_name))
                    .map((row, idx) => (
                      <div key={idx} className="flex items-center h-[20px] pl-handwritten text-[12px]">
                        <span className="truncate flex-1 pr-2">{row.customer_name}</span>
                        <span className="pl-handwritten-strong font-bold text-[13px] pr-1 shrink-0">
                          {formatLedgerAmount(row.amount)}
                        </span>
                      </div>
                    ))
                  }
                </div>

                {/* Gap */}
                <div className="h-[20px]" />

                {/* ─── Grand Total ─── */}
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
