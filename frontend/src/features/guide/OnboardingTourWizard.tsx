import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, X, CheckCircle2 } from "lucide-react";

import { useLanguage } from "@/i18n/LanguageContext";
import { usePreferences } from "@/lib/preferences";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

interface TourStep {
  id: string;
  selector?: string;
  registerView?: "right" | "left";
  title: string;
  titleHi: string;
  description: string;
  descriptionHi: string;
  tip?: string;
  tipHi?: string;
}

const REGISTER_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Daily Register Guide",
    titleHi: "दैनिक रजिस्टर गाइड",
    description:
      "Take a quick arrow tour to see how Nozzle Readings, Slips, UPI, Cash Notes, Full Screen Book, and 8 PM WhatsApp Closing work together.",
    descriptionHi:
      "इस आसान टूर में देखें कि नोज़ल रीडिंग, पर्ची, UPI, नोट गिनती, फुल स्क्रीन कॉपी और 8 PM WhatsApp रिपोर्ट एक साथ कैसे काम करते हैं।",
    tip: "Tip: Tap the (?) icon in the top bar anytime for a tour of whatever page or tab you are on.",
    tipHi: "सुझाव: आप जिस भी पेज या टैब पर हों, ऊपर (?) दबाकर उसका गाइड टूर देख सकते हैं।",
  },
  {
    id: "register-actions",
    selector: '[data-tour="register-actions"]',
    title: "1. Pick Date & Save Meter Readings",
    titleHi: "1. तारीख चुनें और रीडिंग सेव करें",
    description:
      "Use Prev/Next arrows or the calendar to switch dates, and hit 'Save Readings' after filling nozzle meters to auto-deduct underground Tank Stock.",
    descriptionHi:
      "तारीख बदलने के लिए आगे/पीछे बटन दबाएं और नोज़ल भरने के बाद 'Save Readings' दबाएं — टैंक स्टॉक अपने-आप अपडेट होगा।",
  },
  {
    id: "register-fullscreen",
    selector: '[data-tour="register-fullscreen"]',
    title: "2. Full Screen Auto-Fit View",
    titleHi: "2. फुल स्क्रीन व्यू (स्क्रीन में फिट)",
    description:
      "Tap Full Screen to expand the complete 2-page bound register and fit it cleanly onto your screen without side scrolling.",
    descriptionHi:
      "पूरी 2-पेज की कॉपी को बिना दाएं-बाएं खिसकाए एक साथ देखने के लिए 'Full Screen' दबाएं।",
  },
  {
    id: "register-nozzles",
    selector: '[data-tour="register-nozzles"]',
    registerView: "right",
    title: "3. Enter Opening, Closing or Net Liters",
    titleHi: "3. ओपनिंग, क्लोज़िंग या नेट लीटर भरें",
    description:
      "Type Closing reading below Opening and press Enter to jump to the next nozzle. Or type Net Liters directly and Closing fills in automatically!",
    descriptionHi:
      "ओपनिंग के नीचे क्लोज़िंग लिखकर Enter दबाएं और अगले नोज़ल पर जाएं। अगर सिर्फ Net लीटर लिखेंगे, तो क्लोज़िंग अपने-आप जुड़ जाएगी!",
  },
  {
    id: "register-left-entry",
    selector: '[data-tour="register-left-entry"]',
    registerView: "left",
    title: "4. Log Credit Slips, UPI, Cash Income & Expenses",
    titleHi: "4. उधार, UPI, कैश आय और खर्च दर्ज करें",
    description:
      "Choose Type (Credit, Cash Slip, Inc ₹ Cash Income, UPI handle, Expense or Loan), enter Qty → Particulars → Amount, and press Enter. Cash Income moves to Right Page automatically!",
    descriptionHi:
      "Type चुनें (Credit, UPI खाता, कैश आय, खर्च या Loan), फिर मात्रा → विवरण → राशि भरकर Enter दबाएं। कैश आय अपने-आप दाएं पेज पर चली जाएगी।",
  },
  {
    id: "register-denominations",
    selector: '[data-tour="register-denominations"]',
    registerView: "left",
    title: "5. Count Drawer Notes & Bank Deposit",
    titleHi: "5. गल्ले के नोट गिनें और बैंक जमा भरें",
    description:
      "Type counts for ₹500/₹200/₹100 notes and Bank Deposit once — PumpLedger checks Short/Excess cash against Expected Drawer Cash automatically.",
    descriptionHi:
      "₹500/₹200/₹100 के नोट और बैंक जमा डालें — सिस्टम गल्ले में कैश कम या ज़्यादा होने की जांच अपने-आप कर लेता है।",
  },
  {
    id: "register-structured-form",
    selector: '[data-tour="register-structured-form"]',
    title: "6. Interlinked Simple Entry Form Below",
    titleHi: "6. नीचे जुड़ा हुआ आसान फॉर्म",
    description:
      "Prefer typing in clean boxes instead of ledger lines? Enter Meters, Slips/Expenses or Notes here — it updates the bound register above live!",
    descriptionHi:
      "अगर आप रजिस्टर की लाइन की जगह बड़े बॉक्स में टाइप करना चाहते हैं, तो नीचे इस फॉर्म में भरें — ऊपर का रजिस्टर तुरंत अपडेट होगा!",
  },
  {
    id: "register-lock-whatsapp",
    selector: '[data-tour="register-lock-whatsapp"]',
    title: "7. Lock Day & Send 8 PM Owner WhatsApp",
    titleHi: "7. दिन लॉक करें और 8 PM WhatsApp भेजें",
    description:
      "Click 'Save & Lock Day' at closing to update Cash, Bank & Net Profit, then tap 'WhatsApp' to send the complete daily summary to the owner in 1 click.",
    descriptionHi:
      "शाम को 'Save & Lock Day' दबाएं और 1 क्लिक में 'WhatsApp' से मालिक को पूरी बिक्री, कैश और मुनाफे की रिपोर्ट भेजें।",
  },
];

function getStepsForRoute(pathname: string, search: string, isOperator: boolean): TourStep[] {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") || "";

  if (pathname === "/dashboard" && !isOperator) {
    return REGISTER_STEPS;
  }

  if (pathname.startsWith("/dashboard/slips")) {
    const activeLabel =
      tab === "quick"
        ? {
            en: "Quick Manual Slip Tab",
            hi: "फटाफट मैनुअल स्लिप टैब",
            descEn:
              "Enter customer name, fuel, payment mode (Credit, Cash, UPI handle, Card) and exact ₹ or Liters in 5 seconds without taking a photo.",
            descHi:
              "बिना फोटो लिए 5 सेकंड में ग्राहक का नाम, ईंधन, पेमेंट मोड (Credit, Cash, UPI, Card) और राशि या लीटर भरकर स्लिप सेव करें।",
          }
        : tab === "list"
          ? {
              en: "Stored Slips & Invoices Tab",
              hi: "पुरानी पर्चियाँ व बिल टैब",
              descEn:
                "Search or filter every slip by date, customer, vehicle, or payment mode, and inspect original Backblaze slip photos anytime.",
              descHi:
                "तारीख, ग्राहक, गाड़ी या पेमेंट मोड से किसी भी पुरानी पर्ची को खोजें और अपलोड की गई असली फोटो देखें।",
            }
          : {
              en: "Scan Invoice (AI OCR) Tab",
              hi: "बिल स्कैन (AI OCR) टैब",
              descEn:
                "Upload or snap up to 30 handwritten credit slip photos. AI extracts Customer, Vehicle, Qty, and Amount for quick review before posting to Register & Ledger.",
              descHi:
                "एक साथ 30 तक हाथ की पर्चियों की फोटो अपलोड करें। AI ग्राहक, गाड़ी, लीटर और राशि पढ़कर सीधे खाते व रजिस्टर में जोड़ देगा।",
            };

    return [
      {
        id: "slips-tabs",
        selector: '[data-tour="slips-tabs"]',
        title: "Slips & OCR Tabs",
        titleHi: "पर्ची और OCR टैब",
        description:
          "Switch here between AI Photo Scanning, Quick 5-Second Manual Slip entry, and browsing all Stored Slips.",
        descriptionHi:
          "यहाँ से AI फोटो स्कैन, तेज़ मैनुअल स्लिप और सभी पुरानी पर्चियों की सूची के बीच बदलें।",
      },
      {
        id: "slips-content",
        selector: '[data-tour="slips-content"]',
        title: activeLabel.en,
        titleHi: activeLabel.hi,
        description: activeLabel.descEn,
        descriptionHi: activeLabel.descHi,
      },
      {
        id: "slips-done",
        selector: '[data-tour="navbar-guide"]',
        title: "Every Slip Updates the Daily Register",
        titleHi: "हर पर्ची सीधे रजिस्टर में जुड़ती है",
        description:
          "All approved or manual slips appear automatically on today's Daily Register and Customer Dues. Tap (?) anytime when switching tabs!",
        descriptionHi:
          "सेव की गई हर पर्ची अपने-आप दैनिक रजिस्टर और ग्राहक बकाया में जुड़ जाती है। किसी भी टैब पर मदद के लिए (?) दबाएं!",
      },
    ];
  }

  if (pathname.startsWith("/dashboard/customers")) {
    const tabInfo =
      tab === "vehicles"
        ? {
            en: "Vehicles Lifting History",
            hi: "गाड़ियों का ईंधन रिकॉर्ड",
            descEn:
              "Track fuel lifted, slips, and billing totals for every truck, tractor, or fleet vehicle individually.",
            descHi:
              "हर ट्रक, ट्रैक्टर या फ्लीट गाड़ी के हिसाब से डीजल/पेट्रोल की पूरी हिस्ट्री और कुल बिल देखें।",
          }
        : tab === "payments"
          ? {
              en: "Payments Received (Jama)",
              hi: "मिली पेमेंट (जमा वसूली)",
              descEn:
                "Record Cash or Bank/UPI recoveries from customers. Oldest unpaid slips settle automatically (FIFO) and update Cash/Bank balances + Daily Register.",
              descHi:
                "ग्राहकों से कैश या बैंक/UPI में आया पैसा दर्ज करें। पुराने बिल अपने-आप चुकता होंगे और कैश/बैंक व रजिस्टर अपडेट होगा।",
            }
          : {
              en: "Customers & Pending Dues",
              hi: "ग्राहक और बकाया हिसाब",
              descEn:
                "See every credit party's live balance, open their full Statement Print, send a WhatsApp payment reminder, or record a payment.",
              descHi:
                "हर उधार पार्टी का बकाया बैलेंस देखें, पूरा स्टेटमेंट प्रिंट करें या एक क्लिक में WhatsApp रिमाइंडर भेजें।",
            };

    return [
      {
        id: "cust-tabs",
        selector: '[data-tour="customers-tabs"]',
        title: "Customers, Vehicles & Payments",
        titleHi: "ग्राहक, गाड़ियाँ और पेमेंट टैब",
        description:
          "Switch between Party-Wise Dues, Vehicle Ledgers, and Customer Payment Recoveries from this bar.",
        descriptionHi:
          "यहाँ से ग्राहक बकाया, गाड़ी-वार हिसाब और आई हुई पेमेंट के टैब बदलें।",
      },
      {
        id: "cust-content",
        selector: '[data-tour="customers-content"]',
        title: tabInfo.en,
        titleHi: tabInfo.hi,
        description: tabInfo.descEn,
        descriptionHi: tabInfo.descHi,
      },
    ];
  }

  if (pathname.startsWith("/dashboard/inventory")) {
    const tabInfo =
      tab === "deliveries"
        ? {
            en: "Tanker Deliveries (OMC Indents)",
            hi: "टैंकर डिलीवरी",
            descEn:
              "Log IOCL/BPCL/HPCL tanker unloading. Recording a delivery automatically adds liters to your underground tank and deducts bank payment if paid.",
            descHi:
              "टैंकर खाली होने की एंट्री डालें — टैंक स्टॉक अपने-आप बढ़ जाएगा और बैंक पेमेंट अपडेट हो जाएगा।",
          }
        : tab === "setup"
          ? {
              en: "Prices & Nozzle Setup",
              hi: "रेट और नोज़ल सेटअप",
              descEn:
                "Update Petrol/Diesel/Speed daily rates (including 6 AM rate changes) and add or link dispensers & nozzles to underground tanks.",
              descHi:
                "पेट्रोल/डीज़ल/स्पीड के रोज़ाना के रेट बदलें और अपनी मशीन व नोज़ल को टैंक से जोड़ें।",
            }
          : {
              en: "Underground Tanks & Live Stock",
              hi: "टैंक और बचा हुआ स्टॉक",
              descEn:
                "Monitor remaining liters per tank, compare Book Stock vs Physical Dip variance, track tank margins, and toggle Packaged Lube/DEF stock.",
              descHi:
                "हर टैंक में बचा ईंधन देखें, किताब के स्टॉक बनाम डिप अंतर जांचें और ऑयल/DEF स्टॉक देखें।",
            };

    return [
      {
        id: "inv-tabs",
        selector: '[data-tour="inventory-tabs"]',
        title: "Inventory Control Tabs",
        titleHi: "इन्वेंटरी और स्टॉक टैब",
        description:
          "Manage Tanks & Stock, Tanker Deliveries, and Selling Prices & Nozzles across these 3 tabs.",
        descriptionHi:
          "इन 3 टैब्स में टैंक स्टॉक, टैंकर डिलीवरी और ईंधन रेट व नोज़ल संभालें।",
      },
      {
        id: "inv-content",
        selector: '[data-tour="inventory-content"]',
        title: tabInfo.en,
        titleHi: tabInfo.hi,
        description: tabInfo.descEn,
        descriptionHi: tabInfo.descHi,
      },
    ];
  }

  if (pathname.startsWith("/dashboard/money")) {
    const tabInfo =
      tab === "profit"
        ? {
            en: "Commission & Net Profit",
            hi: "कमीशन और शुद्ध मुनाफा",
            descEn:
              "Set your dealer ₹/L margin for Petrol, Diesel & Speed to see exact daily & monthly profit automatically calculated minus expenses.",
            descHi:
              "पेट्रोल/डीज़ल का प्रति लीटर डीलर कमीशन (₹/L) सेट करें ताकि रोज़ाना का सही मुनाफा खर्च घटाकर दिख सके।",
          }
        : tab === "reports"
          ? {
              en: "All Accounting Reports",
              hi: "सभी अकाउंटिंग रिपोर्ट्स",
              descEn:
                "View and export Daily Sales, Debtor Aging, Cash Flow, Profit & Loss, and GST reports anytime.",
              descHi:
                "दैनिक बिक्री, उधार उम्र, कैश फ्लो, मुनाफा और GST रिपोर्ट्स देखें और डाउनलोड करें।",
            }
          : {
              en: "Cash in Hand & Bank Balances",
              hi: "हाथ में कैश और बैंक बैलेंस",
              descEn:
                "Track drawer cash, HDFC/SBI bank balances, UPI handles (Paytm/PhonePe/GPay), and cash deposits between drawer and bank.",
              descHi:
                "ड्रॉअर में कैश, हर बैंक खाते का बैलेंस, UPI खाते और बैंक में कैश जमा का पूरा हिसाब रखें।",
            };

    return [
      {
        id: "money-tabs",
        selector: '[data-tour="money-tabs"]',
        title: "Money & Profit Tabs",
        titleHi: "पैसा और मुनाफा टैब",
        description:
          "Check Cash & Bank Balances, configure ₹/L Commission Profit, and export All Reports from these tabs.",
        descriptionHi:
          "कैश व बैंक बैलेंस, प्रति लीटर कमीशन मुनाफा और सभी रिपोर्ट्स इन टैब्स से देखें।",
      },
      {
        id: "money-content",
        selector: '[data-tour="money-content"]',
        title: tabInfo.en,
        titleHi: tabInfo.hi,
        description: tabInfo.descEn,
        descriptionHi: tabInfo.descHi,
      },
    ];
  }

  if (pathname.startsWith("/dashboard/settings")) {
    const tabInfo =
      tab === "tally"
        ? {
            en: "Tally ERP XML Export",
            hi: "Tally XML एक्सपोर्ट",
            descEn:
              "Generate Sales, Receipt, Payment & Contra XML files ready to import directly into TallyPrime / Tally ERP 9.",
            descHi:
              "सीधे TallyPrime या Tally ERP 9 में इम्पोर्ट करने के लिए Sales, Receipt और Payment XML बनाएं।",
          }
        : tab === "audit"
          ? {
              en: "Activity & Audit Log",
              hi: "गतिविधि व ऑडिट लॉग",
              descEn:
                "Inspect a complete tamper-evident timeline of edited readings, reopened days, deleted slips, and logins.",
              descHi:
                "बदली गई रीडिंग, रीओपन दिन और डिलीट की गई एंट्री का पूरा इतिहास यहाँ देखें।",
            }
          : tab === "users"
            ? {
                en: "Users & Database Backup",
                hi: "यूज़र और डेटाबेस बैकअप",
                descEn:
                  "Create Manager or Operator accounts with role permissions and download a full database backup.",
                descHi:
                  "मैनेजर व स्टाफ अकाउंट बनाएं और अपने पंप के डेटा का पूरा बैकअप लें।",
              }
            : {
                en: "Staff & Monthly Payroll",
                hi: "स्टाफ और सैलरी हिसाब",
                descEn:
                  "Track daily staff attendance, cash advances, deductions, and monthly salary payments in Cash or Bank.",
                descHi:
                  "कर्मचारियों की रोज़ की हाज़िरी, एडवांस और महीने की सैलरी पेमेंट यहाँ दर्ज करें।",
              };

    return [
      {
        id: "settings-tabs",
        selector: '[data-tour="settings-tabs"]',
        title: "Settings & Tools Tabs",
        titleHi: "सेटिंग्स और टूल्स टैब",
        description:
          "Switch between Staff & Payroll, Tally Export, Activity Log, and Users & Backup.",
        descriptionHi:
          "स्टाफ सैलरी, Tally एक्सपोर्ट, ऑडिट लॉग और यूज़र बैकअप के बीच यहाँ से बदलें।",
      },
      {
        id: "settings-content",
        selector: '[data-tour="settings-content"]',
        title: tabInfo.en,
        titleHi: tabInfo.hi,
        description: tabInfo.descEn,
        descriptionHi: tabInfo.descHi,
      },
    ];
  }

  if (isOperator || pathname.startsWith("/dashboard/quick-entry")) {
    return [
      {
        id: "op-slips",
        selector: '[data-tour="nav-slips"]',
        title: "Scan or Add Fuel Slips",
        titleHi: "पर्ची स्कैन करें या जोड़ें",
        description:
          "Tap here to upload handwritten slip photos (AI OCR) or enter a quick manual slip in seconds.",
        descriptionHi:
          "पर्ची की फोटो अपलोड करने या फटाफट मैनुअल पर्ची भरने के लिए यहाँ दबाएं।",
      },
      {
        id: "op-guide",
        selector: '[data-tour="navbar-guide"]',
        title: "Section Help (?)",
        titleHi: "किसी भी सेक्शन की मदद (?)",
        description:
          "Tap (?) anytime in the top bar for step-by-step guidance on the screen you have open.",
        descriptionHi:
          "आप जिस भी स्क्रीन पर हों, उसकी जानकारी के लिए कभी भी ऊपर (?) दबाएं।",
      },
    ];
  }

  return [
    {
      id: "page-guide",
      selector: '[data-tour="navbar-guide"]',
      title: "Page Tour",
      titleHi: "पेज टूर",
      description:
        "Use the sidebar or bottom bar to open Daily Register, Slips & OCR, Customers, Inventory, or Money & Profit — tap (?) on any screen or tab to see how it works!",
      descriptionHi:
        "नीचे या साइड मेनू से दैनिक रजिस्टर, पर्ची व OCR, ग्राहक, स्टॉक या मुनाफा खोलें — किसी भी स्क्रीन या टैब पर (?) दबाकर उसका गाइड देखें!",
    },
  ];
}

interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findVisibleElement(selector: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const el of matches) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return el;
    }
  }
  return null;
}

export function OnboardingTourWizard() {
  const { user } = useCurrentUser();
  const location = useLocation();
  const { lang, toggleLang } = useLanguage();
  const { focusMode, hasCompletedTour, setHasCompletedTour } = usePreferences();

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<RectBox | null>(null);
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1024,
    h: typeof window !== "undefined" ? window.innerHeight : 768,
  }));
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(215);

  const hasAutoLaunchedRef = useRef(false);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const isHi = lang === "hi";
  const isOperator = user?.role === "OPERATOR";
  const steps = useMemo(
    () => getStepsForRoute(location.pathname, location.search, isOperator),
    [location.pathname, location.search, isOperator]
  );
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];

  // Auto-launch strictly ONCE per first-time session on entry route; never reset active steps
  useEffect(() => {
    if (hasCompletedTour || focusMode || !user || hasAutoLaunchedRef.current || isOpenRef.current) {
      return;
    }
    const isEntryRoute =
      location.pathname === "/dashboard" ||
      (isOperator && location.pathname === "/dashboard/quick-entry");
    if (!isEntryRoute) return;

    hasAutoLaunchedRef.current = true;
    const timer = window.setTimeout(() => {
      if (!isOpenRef.current) {
        setStepIndex(0);
        setIsOpen(true);
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [hasCompletedTour, focusMode, user, location.pathname, isOperator]);

  // Triggered by (?) button in Top Navbar — tours the active section & tab immediately without navigating away
  useEffect(() => {
    const handleStart = () => {
      hasAutoLaunchedRef.current = true;
      setStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener("pumpledger:start-tour", handleStart);
    return () => window.removeEventListener("pumpledger:start-tour", handleStart);
  }, []);

  // Clamp stepIndex safely if tab/route switches while tour stays open
  useEffect(() => {
    if (stepIndex >= steps.length) {
      setStepIndex(0);
    }
  }, [steps.length, stepIndex]);

  const measureTarget = useCallback(
    (shouldScroll: boolean) => {
      if (!isOpen || !currentStep) return;
      setViewport({ w: window.innerWidth, h: window.innerHeight });

      if (!currentStep.selector) {
        setTargetRect(null);
        return;
      }

      const el = findVisibleElement(currentStep.selector);
      if (!el) {
        setTargetRect(null);
        return;
      }

      if (shouldScroll) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }

      const rect = el.getBoundingClientRect();
      const pad = 6;
      const clampedLeft = Math.max(4, rect.left - pad);
      const clampedRight = Math.min(window.innerWidth - 4, rect.right + pad);
      setTargetRect({
        top: Math.max(4, rect.top - pad),
        left: clampedLeft,
        width: Math.max(24, clampedRight - clampedLeft),
        height: rect.height + pad * 2,
      });
    },
    [isOpen, currentStep]
  );

  useEffect(() => {
    if (!isOpen || !currentStep) return;
    if (currentStep.registerView) {
      window.dispatchEvent(
        new CustomEvent("pumpledger:tour-register-view", { detail: currentStep.registerView })
      );
    }

    const t1 = window.setTimeout(() => measureTarget(true), 80);
    const t2 = window.setTimeout(() => measureTarget(false), 380);

    const onUpdate = () => measureTarget(false);
    window.addEventListener("resize", onUpdate);
    window.addEventListener("scroll", onUpdate, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("scroll", onUpdate, true);
    };
  }, [isOpen, currentStep, measureTarget]);

  useLayoutEffect(() => {
    if (cardRef.current) {
      const h = cardRef.current.getBoundingClientRect().height;
      if (h > 0) setCardHeight(h);
    }
  }, [isOpen, stepIndex, isHi, currentStep]);

  const finishTour = useCallback(() => {
    setIsOpen(false);
    setHasCompletedTour(true);
  }, [setHasCompletedTour]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finishTour();
      } else if (e.key === "ArrowRight") {
        setStepIndex((i) => (i < steps.length - 1 ? i + 1 : i));
      } else if (e.key === "ArrowLeft") {
        setStepIndex((i) => (i > 0 ? i - 1 : i));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, steps.length, finishTour]);

  if (!isOpen || !currentStep) return null;

  const isLast = stepIndex === steps.length - 1;
  const cardWidth = Math.min(340, viewport.w - 24);
  const gap = 34;

  let cardTop = Math.max(16, (viewport.h - cardHeight) / 2);
  let cardLeft = Math.max(12, (viewport.w - cardWidth) / 2);
  let arrowCoords: { x1: number; y1: number; x2: number; y2: number } | null = null;

  if (targetRect) {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const targetBottom = targetRect.top + targetRect.height;
    const spaceBelow = viewport.h - targetBottom;
    const spaceAbove = targetRect.top;

    cardLeft = Math.min(
      Math.max(12, targetCenterX - cardWidth / 2),
      viewport.w - cardWidth - 12
    );

    if (spaceBelow >= cardHeight + gap + 12 || spaceBelow >= spaceAbove) {
      cardTop = Math.min(targetBottom + gap, viewport.h - cardHeight - 12);
      const arrowStartY = cardTop;
      const arrowEndY = Math.min(arrowStartY - 8, targetBottom + 4);
      const clampedTargetX = Math.min(Math.max(20, targetCenterX), viewport.w - 20);
      const cardAttachX = Math.min(
        Math.max(cardLeft + 24, clampedTargetX),
        cardLeft + cardWidth - 24
      );
      if (arrowStartY - arrowEndY > 14) {
        arrowCoords = {
          x1: cardAttachX,
          y1: arrowStartY - 2,
          x2: clampedTargetX,
          y2: arrowEndY,
        };
      }
    } else {
      cardTop = Math.max(12, targetRect.top - cardHeight - gap);
      const arrowStartY = cardTop + cardHeight;
      const arrowEndY = Math.max(arrowStartY + 8, targetRect.top - 4);
      const clampedTargetX = Math.min(Math.max(20, targetCenterX), viewport.w - 20);
      const cardAttachX = Math.min(
        Math.max(cardLeft + 24, clampedTargetX),
        cardLeft + cardWidth - 24
      );
      if (arrowEndY - arrowStartY > 14) {
        arrowCoords = {
          x1: cardAttachX,
          y1: arrowStartY + 2,
          x2: clampedTargetX,
          y2: arrowEndY,
        };
      }
    }
  }

  return (
    <div
      data-no-translate="true"
      className="fixed inset-0 z-[100] pointer-events-auto no-print"
      role="dialog"
      aria-modal="true"
    >
      {!targetRect && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity"
          onClick={finishTour}
        />
      )}

      {targetRect && (
        <div
          className="fixed rounded-xl border-2 border-fuel-amber pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: "0 0 0 9999px rgba(8, 7, 6, 0.75), 0 0 24px rgba(245, 158, 11, 0.65)",
          }}
        />
      )}

      {arrowCoords && (
        <svg
          className="fixed inset-0 w-full h-full pointer-events-none z-[101]"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="pl-tour-arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="7"
              refY="5"
              orient="auto"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>
          <path
            d={`M ${arrowCoords.x1} ${arrowCoords.y1} Q ${
              (arrowCoords.x1 + arrowCoords.x2) / 2
            } ${(arrowCoords.y1 + arrowCoords.y2) / 2} ${arrowCoords.x2} ${arrowCoords.y2}`}
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 4"
            fill="none"
            markerEnd="url(#pl-tour-arrowhead)"
            className="animate-pulse"
          />
        </svg>
      )}

      <div
        ref={cardRef}
        className="fixed z-[102] rounded-2xl border border-fuel-amber/50 bg-surface-1 p-4 shadow-2xl text-ink transition-all duration-300"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-fuel-amber/15 border border-fuel-amber/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-fuel-amber">
            <Sparkles size={11} />
            {isHi ? `कदम ${stepIndex + 1} / ${steps.length}` : `Step ${stepIndex + 1} of ${steps.length}`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLang}
              className="rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-[10px] font-bold text-ink-muted hover:text-ink cursor-pointer"
            >
              {isHi ? "English" : "हिंदी"}
            </button>
            <button
              type="button"
              onClick={finishTour}
              aria-label="Skip Demo"
              className="rounded-md p-1 text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
              title={isHi ? "बंद करें" : "Skip tour"}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <h3 className="text-sm font-bold text-ink leading-snug">
          {isHi ? currentStep.titleHi : currentStep.title}
        </h3>
        <p className="mt-1.5 text-xs text-ink-muted leading-relaxed">
          {isHi ? currentStep.descriptionHi : currentStep.description}
        </p>

        {currentStep.tip && (
          <p className="mt-2 rounded-lg bg-fuel-amber/10 border border-fuel-amber/20 px-2.5 py-1.5 text-[11px] font-medium text-fuel-amber">
            {isHi ? currentStep.tipHi : currentStep.tip}
          </p>
        )}

        <div className="mt-3.5 pt-2.5 border-t border-hairline flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finishTour}
            className="text-[11px] font-medium text-ink-muted hover:text-ink cursor-pointer"
          >
            {isHi ? "छोड़ें (Skip)" : "Skip"}
          </button>

          <div className="flex items-center gap-1">
            {steps.map((s, idx) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  idx === stepIndex ? "w-4 bg-fuel-amber" : "w-1.5 bg-hairline-strong"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-xs font-semibold text-ink hover:bg-surface-3 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={finishTour}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                <CheckCircle2 size={13} />
                {isHi ? "शुरू करें" : "Got It!"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                className="inline-flex items-center gap-1 rounded-lg bg-fuel-amber hover:bg-fuel-orange px-3 py-1.5 text-xs font-bold text-canvas cursor-pointer"
              >
                {isHi ? "आगे" : "Next"}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
