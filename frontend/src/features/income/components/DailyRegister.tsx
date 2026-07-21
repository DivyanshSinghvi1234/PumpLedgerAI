import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

interface DailyRegisterProps {
  date: string;
  onDateChange(d: string): void;
}

export default function DailyRegister({ date, onDateChange }: DailyRegisterProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);

  // Format date to DD-MM-YYYY for that authentic ledger header look
  function formatDateString(dateStr: string) {
    if (!dateStr) return "09.07.2026";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  }

  const registerDate = formatDateString(date);

  // ponytail: static demo data. Ceiling: not wired to real dispenser/nozzle
  // readings. Upgrade: pass a `dispensers` prop sourced from the inventory
  // meter-readings API (max 4 nozzles per dispenser render evenly).
  const dispensers = [
    {
      name: "H.S.D Dispenser",
      nozzles: [
        { name: "Nozzle 1", closing: "5129", opening: "4969", difference: "160" },
        { name: "Nozzle 2", closing: "13846", opening: "10859", difference: "2987" },
      ],
    },
    {
      name: "M.S Dispenser",
      nozzles: [
        { name: "Nozzle 1", closing: "12950", opening: "8440", difference: "4510" },
        { name: "Nozzle 2", closing: "3092", opening: "2853", difference: "239" },
      ],
    },
  ];

  // Handle page turn animation trigger
  function handlePageTurn(direction: "next" | "prev") {
    if (isFlipping) return;
    setIsFlipping(true);
    setFlipDirection(direction);

    // Calculate new date
    const d = new Date(date);
    d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
    const newDateStr = d.toISOString().split("T")[0];

    setTimeout(() => {
      onDateChange(newDateStr);
      setIsFlipping(false);
      setFlipDirection(null);
    }, 600); // Sync with CSS transition length (0.6s)
  }

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="flex items-center justify-between bg-surface-1 border border-hairline p-4 rounded-2xl shadow-md">
        <div className="flex items-center gap-2">
          <BookOpen className="text-fuel-amber h-5 w-5" />
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            Ledger Register View
            <span className="text-[10px] font-mono bg-fuel-amber/10 text-fuel-amber border border-fuel-amber/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={10} /> Handwritten Mode
            </span>
          </h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageTurn("prev")}
            disabled={isFlipping}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-ink hover:bg-surface-3 transition disabled:opacity-30 cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="px-4 py-1.5 bg-surface-2 border border-hairline rounded-xl text-xs font-mono font-semibold text-ink">
            {registerDate}
          </div>

          <button
            onClick={() => handlePageTurn("next")}
            disabled={isFlipping}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-ink hover:bg-surface-3 transition disabled:opacity-30 cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Register 3D Book Layout */}
      <div className="book-container w-full overflow-hidden py-4 flex justify-center">
        <div className="relative w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-2 gap-0 border border-amber-900/10 rounded-lg shadow-2xl overflow-hidden bg-amber-950/5 p-[1px]">
          
          {/* Central Spine Shadow Overlay */}
          <div className="book-spine-shadow pointer-events-none hidden md:block" />

          {/* Left Page (Vouchers and Cash counts) */}
          <div className={`book-sheet min-h-[780px] p-6 pb-12 select-none ${isFlipping && flipDirection === "next" ? "page-turn-r2l" : ""}`}>
            {/* Header Content */}
            <div className="relative border-b border-blue-900/20 pb-4 mb-4 handwritten-ink flex justify-between items-start">
              {/* Top Left Pump Readings */}
              <div className="text-[11px] leading-4 border border-blue-900/15 bg-blue-900/5 px-2 py-1 rounded">
                <div>H.S.D I = 58 - 5129</div>
                <div>H.S.D II = 124 - 13846</div>
                <div>M.S I = 154 - 12950</div>
                <div>M.S II = 66 - 3092</div>
              </div>
              
              {/* Salutation & Date */}
              <div className="text-center flex-1 pr-6">
                <div className="text-sm font-semibold tracking-wider">श्रीगणेशाय नमः</div>
                <div className="text-xs border-b border-blue-900/25 inline-block px-4 mt-0.5">{registerDate}</div>
              </div>
            </div>

            {/* Ruled Transaction Rows */}
            <div className="space-y-0 text-xs">
              {/* Columns Header */}
              <div className="grid grid-cols-[60px_1fr_90px] border-b border-red-500/20 font-bold handwritten-ink-red pb-1 mb-2">
                <div className="text-center">Liters</div>
                <div className="pl-4">Particulars / Customer Accounts</div>
                <div className="text-right">Amount (₹)</div>
              </div>

              {/* Transactions list replicating actual book rows */}
              <div className="handwritten-ink space-y-[2px]">
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">152.45</div>
                  <div className="pl-4">सी० मोनुभादप</div>
                  <div className="text-right font-bold">15000=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">142.59</div>
                  <div className="pl-4">सी० मोनुभादप</div>
                  <div className="text-right font-bold">14000=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">141.28</div>
                  <div className="pl-4">सी० मोनुभादप</div>
                  <div className="text-right font-bold">13900=54</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">172.78</div>
                  <div className="pl-4">सी० मोनुभादप</div>
                  <div className="text-right font-bold">17000=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">13.48</div>
                  <div className="pl-4">सी० त्रिजी म. गेस</div>
                  <div className="text-right font-bold">1326=30</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">13</div>
                  <div className="pl-4">सी० त्रिजी म. गेस</div>
                  <div className="text-right font-bold">1475=85</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">5</div>
                  <div className="pl-4">सी० त्रिदीपम गेस</div>
                  <div className="text-right font-bold">491=35</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">17</div>
                  <div className="pl-4">सी० त्रिदीपम गेस</div>
                  <div className="text-right font-bold">1673=63</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">508.18</div>
                  <div className="pl-4">सी० उभेग चोभारी (गाडी MH1485)</div>
                  <div className="text-right font-bold text-blue-900">50000=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">150</div>
                  <div className="pl-4">सी० राजिया विरियालय</div>
                  <div className="text-right font-bold">14758=50</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">553.91</div>
                  <div className="pl-4">सी० कोल आर डी</div>
                  <div className="text-right font-bold text-blue-900">54500=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">1501.83</div>
                  <div className="pl-4">पेटीएम (Paytm) दिया</div>
                  <div className="text-right font-bold">147765=70</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">23.04</div>
                  <div className="pl-4">सी० आर आर (योग) मशीन</div>
                  <div className="text-right font-bold">2267=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px]">
                  <div className="text-center font-bold text-blue-900/70">0.88</div>
                  <div className="pl-4">सी० मुकेश (पेट्रोल)</div>
                  <div className="text-right font-bold">100=00</div>
                </div>
                
                {/* Miscellaneous expenses inside the sheet */}
                <div className="grid grid-cols-[60px_1fr_90px] text-red-700/80 border-t border-dashed border-red-500/10 mt-1">
                  <div className="text-center">—</div>
                  <div className="pl-4">उधारी रोक (उसने)</div>
                  <div className="text-right">500=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px] text-red-700/80">
                  <div className="text-center">—</div>
                  <div className="pl-4">खिंचवाड़ी को वेतन दिया</div>
                  <div className="text-right">2000=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px] text-red-700/80">
                  <div className="text-center">—</div>
                  <div className="pl-4">भोगीजी नागर को रोक के दिए</div>
                  <div className="text-right">300=00</div>
                </div>
                <div className="grid grid-cols-[60px_1fr_90px] text-red-700/80">
                  <div className="text-center">—</div>
                  <div className="pl-4">ओमप्रकाशजी को गाडन करने के दिए</div>
                  <div className="text-right">1700=00</div>
                </div>
              </div>
            </div>

            {/* Currency Breakdown Block */}
            <div className="mt-6 border-t-2 border-red-500/25 pt-4 grid grid-cols-[1.2fr_1fr] gap-4 handwritten-ink text-[11px] leading-5">
              <div className="border-r border-blue-900/10 pr-2">
                <div className="font-bold border-b border-blue-900/20 mb-1 handwritten-ink-red">Cash Breakdown</div>
                <div className="grid grid-cols-[80px_10px_1fr]"><span>500 x 771</span><span>=</span><span className="text-right font-bold">3,85,500</span></div>
                <div className="grid grid-cols-[80px_10px_1fr]"><span>200 x 400</span><span>=</span><span className="text-right font-bold">80,000</span></div>
                <div className="grid grid-cols-[80px_10px_1fr]"><span>100 x 420</span><span>=</span><span className="text-right font-bold">42,000</span></div>
                <div className="grid grid-cols-[80px_10px_1fr]"><span>50 x 33</span><span>=</span><span className="text-right font-bold">1,650</span></div>
                <div className="grid grid-cols-[80px_10px_1fr]"><span>20 x 15</span><span>=</span><span className="text-right font-bold">300</span></div>
                <div className="grid grid-cols-[80px_10px_1fr]"><span>10 x 5</span><span>=</span><span className="text-right font-bold">50</span></div>
                <div className="grid grid-cols-[80px_10px_1fr] border-t border-blue-900/20 mt-1 pt-1 font-bold text-emerald-800">
                  <span>नगदी रोखाम</span><span>=</span><span className="text-right">5,09,500</span>
                </div>
              </div>

              <div className="flex flex-col justify-end text-xs">
                <div className="flex justify-between"><span>नगदी रोखाम:</span><span className="font-bold">5,09,500</span></div>
                <div className="flex justify-between border-b border-blue-900/10"><span>उधारी रोखाम:</span><span className="font-bold">3,38,758</span></div>
                <div className="flex justify-between"><span>देश घर पर:</span><span className="font-bold">3,47,020</span></div>
                <div className="flex justify-between border-b border-blue-900/15"><span>जमा देगी माईसाण:</span><span className="font-bold">89,01,070</span></div>
                <div className="flex justify-between font-bold text-red-800 mt-1 border-t-2 border-double border-red-500/30 pt-1 text-sm">
                  <span>Total Register:</span>
                  <span>1,00,96,348</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Page (Dispenser Readings and Daily Sales Math) */}
          <div className={`book-sheet-right min-h-[780px] p-6 pb-12 select-none border-t border-amber-900/5 md:border-t-0 ${isFlipping && flipDirection === "prev" ? "page-turn-l2r" : ""}`}>
            
            {/* Header Content */}
            <div className="relative border-b border-blue-900/20 pb-4 mb-4 handwritten-ink flex justify-between items-start">
              <div className="text-center flex-1">
                <div className="text-sm font-semibold tracking-wider">श्रीगणेशाय नमः</div>
                <div className="text-xs border-b border-blue-900/25 inline-block px-4 mt-0.5">{registerDate}</div>
              </div>
            </div>

            {/* Dispenser readings — per dispenser: name, double red line, then
                nozzle name / closing / opening / difference, up to 4 nozzles.
                ponytail: static demo data. Ceiling: not wired to real
                dispenser/nozzle readings. Upgrade: pass a `dispensers` prop
                sourced from the inventory meter-readings API. */}
            <div className="handwritten-ink text-[11px] leading-5 space-y-5">
              {dispensers.map((dispenser, di) => (
                <div key={di}>
                  <div className="font-bold text-blue-900">{dispenser.name}</div>
                  <div className="border-b-2 border-double border-red-500/40 mb-1" />
                  <div
                    className="grid text-right gap-1 items-center"
                    style={{ gridTemplateColumns: `auto repeat(${dispenser.nozzles.length}, minmax(0, 1fr))` }}
                  >
                    <span className="text-left text-[10px] text-blue-900/50" />
                    {dispenser.nozzles.map((n, ni) => (
                      <span key={ni} className="text-center font-bold text-blue-900">{n.name}</span>
                    ))}
                    <span className="text-left text-[10px] text-blue-900/50">Closing</span>
                    {dispenser.nozzles.map((n, ni) => (
                      <span key={ni} className="text-center">{n.closing}</span>
                    ))}
                    <span className="text-left text-[10px] text-blue-900/50">Opening</span>
                    {dispenser.nozzles.map((n, ni) => (
                      <span key={ni} className="text-center border-b border-dashed border-blue-900/10">{n.opening}</span>
                    ))}
                    <span className="text-left text-[10px] text-blue-900/50">Difference</span>
                    {dispenser.nozzles.map((n, ni) => (
                      <span key={ni} className="text-center font-bold text-emerald-800">{n.difference}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Dispatch math formulas in the center */}
            <div className="mt-8 border-t border-red-500/20 pt-4 space-y-3 handwritten-ink text-[12px] leading-6">
              <div className="text-blue-900 font-bold border-b border-blue-900/10 pb-1">Daily Stock Reconciliation Math</div>
              
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>H.S.D I Delivery</span>
                  <span className="font-bold">160 Liters</span>
                </div>
                <div className="flex justify-between">
                  <span>H.S.D II Delivery</span>
                  <span className="font-bold">2,987 Liters</span>
                </div>
              </div>

              <div className="bg-blue-900/5 p-3 rounded-lg space-y-2 border border-blue-900/10 text-xs">
                {/* Dynamic equation layouts */}
                <div className="flex flex-wrap items-center gap-1 font-mono text-blue-950 font-bold">
                  <span className="text-[10px] bg-blue-900/10 text-blue-800 px-1 rounded">H.S.D I</span>
                  <span>(3147 - 10) = 3137 L</span>
                  <span className="text-red-700/60">x ₹98.39</span>
                  <span className="ml-auto text-emerald-800">₹3,08,649=43</span>
                </div>

                <div className="flex flex-wrap items-center gap-1 font-mono text-blue-950 font-bold">
                  <span className="text-[10px] bg-amber-900/10 text-amber-800 px-1 rounded">M.S I</span>
                  <span>(4510 - 20) = 4490 L</span>
                  <span className="text-red-700/60">x ₹113.35</span>
                  <span className="ml-auto text-emerald-800">₹5,08,941=50</span>
                </div>

                <div className="flex flex-wrap items-center gap-1 font-mono text-blue-950 font-bold">
                  <span className="text-[10px] bg-emerald-900/10 text-emerald-800 px-1 rounded">M.S II</span>
                  <span>(239 - 10) = 229 L</span>
                  <span className="text-red-700/60">x ₹123.00</span>
                  <span className="ml-auto text-emerald-800">₹28,167=00</span>
                </div>
              </div>

              {/* Totals & accounts summaries */}
              <div className="border-t border-blue-900/20 pt-4 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>जमा देगी माईसाण (Calculated Fuel Sales)</span>
                  <span className="font-bold">3,47,020=00</span>
                </div>
                <div className="flex justify-between">
                  <span>व्याज (Daily Ledger Interest)</span>
                  <span className="font-bold">2,500=00</span>
                </div>
                <div className="flex justify-between text-red-800 font-bold text-sm border-t-2 border-double border-red-500/30 pt-2 mt-2">
                  <span>Grand Total Accounts</span>
                  <span>1,00,96,347=93</span>
                </div>
              </div>
            </div>
            
            {/* Ruled lines watermark effect */}
            <div className="absolute bottom-4 right-6 text-[10px] font-mono opacity-25">
              Ruled Book Format · PumpLedger AI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
