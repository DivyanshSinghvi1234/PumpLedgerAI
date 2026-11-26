import { useState } from "react";
import { Info } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const TERM_DEFINITIONS: Record<string, { en: string; hi: string }> = {
  "Opening Float": {
    en: "Cash carried forward from yesterday's closing drawer for today's change.",
    hi: "कल के दिन बंद से आज सुबह खुल्ले पैसे के लिए आगे लाया गया कैश।",
  },
  "Dip Variance": {
    en: "Difference between physical tank dip stock and book stock (nozzle sales minus deliveries).",
    hi: "टैंक में वास्तविक डिप स्टॉक और किताबों के स्टॉक के बीच का अंतर।",
  },
  "Unallocated Advance": {
    en: "Extra payment received from a customer that hasn't been matched to a specific unpaid bill yet.",
    hi: "ग्राहक से मिला अतिरिक्त भुगतान जो अभी किसी बिल से नहीं जुड़ा है।",
  },
  "FIFO Allocation": {
    en: "Oldest unpaid bills are automatically settled first when a customer pays.",
    hi: "ग्राहक द्वारा भुगतान करने पर सबसे पुराने बकाया बिल पहले चुकता होते हैं।",
  },
  "Avg Cost/L": {
    en: "Weighted average landed cost per liter across your remaining tank stock and new tanker deliveries.",
    hi: "टैंक में बचे स्टॉक और नई टैंकर डिलीवरी की औसत खरीद कीमत प्रति लीटर।",
  },
};

export function TermTooltip({ term }: { term: keyof typeof TERM_DEFINITIONS | string }) {
  const [open, setOpen] = useState(false);
  const { lang } = useLanguage();
  const def = TERM_DEFINITIONS[term];
  if (!def) return null;

  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-ink-subtle hover:text-fuel-amber cursor-pointer"
        aria-label={`Explain ${term}`}
      >
        <Info size={12} />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-lg border border-hairline bg-surface-1 p-2 text-[11px] font-normal text-ink shadow-xl z-50 leading-snug">
          <strong className="block text-fuel-amber mb-0.5">{term}</strong>
          {lang === "hi" ? def.hi : def.en}
        </span>
      )}
    </span>
  );
}
