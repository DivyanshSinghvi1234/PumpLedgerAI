import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

const MANAGER_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Digital Daily Register",
    titleHi: "आपके डिजिटल दैनिक रजिस्टर में स्वागत है",
    description:
      "Take a 45-second interactive arrow tour to see how Nozzle Readings, Slips, UPI, Cash Denominations, and 8 PM WhatsApp Closing work together.",
    descriptionHi:
      "45 सेकंड के इस टूर में देखें कि नोज़ल रीडिंग, पर्ची, UPI, नोट गिनती और 8 PM WhatsApp रिपोर्ट एक साथ कैसे काम करते हैं।",
    tip: "Tip: You can replay this arrow guide anytime from the Guide (?) button.",
    tipHi: "सुझाव: आप ऊपर 'Guide (?)' बटन से यह टूर कभी भी दोबारा देख सकते हैं।",
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
    id: "register-nozzles",
    selector: '[data-tour="register-nozzles"]',
    registerView: "right",
    title: "2. Enter Opening, Closing or Net Liters",
    titleHi: "2. ओपनिंग, क्लोज़िंग या नेट लीटर भरें",
    description:
      "Type Closing reading below Opening and press Enter to jump straight to the next nozzle. Or type Net Liters directly and Closing fills in automatically!",
    descriptionHi:
      "ओपनिंग के नीचे क्लोज़िंग लिखकर Enter दबाएं और सीधे अगले नोज़ल पर जाएं। अगर सिर्फ Net लीटर लिखेंगे, तो क्लोज़िंग अपने-आप जुड़ जाएगी!",
  },
  {
    id: "register-left-entry",
    selector: '[data-tour="register-left-entry"]',
    registerView: "left",
    title: "3. Log Credit Slips, UPI, Cash Income & Expenses",
    titleHi: "3. उधार, UPI, कैश आय और खर्च दर्ज करें",
    description:
      "Choose Type (Credit, Cash Slip, Cash Income, UPI handle, Expense or Loan), enter Qty → Particulars → Amount, and press Enter. Cash Income automatically moves to the Right Page!",
    descriptionHi:
      "Type चुनें (Credit, UPI खाता, Cash आय, खर्च या Loan), फिर मात्रा → विवरण → राशि भरकर Enter दबाएं। कैश आय अपने-आप दाएं पेज पर चली जाएगी।",
  },
  {
    id: "register-denominations",
    selector: '[data-tour="register-denominations"]',
    registerView: "left",
    title: "4. Count Drawer Notes & Bank Deposit",
    titleHi: "4. गल्ले के नोट गिनें और बैंक जमा भरें",
    description:
      "Type counts for ₹500/₹200/₹100 notes and Bank Deposit once — PumpLedger checks Short/Excess cash against Expected Drawer Cash automatically.",
    descriptionHi:
      "₹500/₹200/₹100 के नोट और बैंक जमा डालें — सिस्टम गल्ले में कैश कम या ज़्यादा होने की जांच अपने-आप कर लेता है।",
  },
  {
    id: "register-lock-whatsapp",
    selector: '[data-tour="register-lock-whatsapp"]',
    title: "5. Lock Day & Send 8 PM Owner WhatsApp",
    titleHi: "5. दिन लॉक करें और 8 PM WhatsApp भेजें",
    description:
      "Click 'Save & Lock Day' at closing to update Cash, Bank & Net Profit, then tap 'WhatsApp' to send the complete daily summary to the owner in 1 click.",
    descriptionHi:
      "शाम को 'Save & Lock Day' दबाएं और 1 क्लिक में 'WhatsApp' से मालिक को पूरी बिक्री, कैश और मुनाफे की रिपोर्ट भेजें।",
  },
  {
    id: "nav-slips",
    selector: '[data-tour="nav-slips"]',
    title: "6. Scan Handwritten Slips with AI OCR",
    titleHi: "6. हाथ की पर्चियाँ AI OCR से स्कैन करें",
    description:
      "Have a stack of paper credit slips? Tap here to snap photos — AI reads the Customer, Vehicle, Fuel & Amount directly into Customer Ledger & Register.",
    descriptionHi:
      "पर्चियों की फोटो खींचें — AI अपने-आप ग्राहक, गाड़ी और राशि पढ़कर खाते और रजिस्टर में जोड़ देगा।",
  },
  {
    id: "navbar-guide",
    selector: '[data-tour="navbar-guide"]',
    title: "Need Help Anytime?",
    titleHi: "कभी भी मदद चाहिए?",
    description:
      "Tap Guide (?) anytime for Hindi/English instructions or to replay this interactive arrow walkthrough.",
    descriptionHi:
      "हिंदी या अंग्रेजी में किसी भी स्क्रीन की मदद लेने या यह टूर दोबारा चलाने के लिए कभी भी Guide (?) दबाएं।",
  },
];

const OPERATOR_STEPS: TourStep[] = [
  {
    id: "op-welcome",
    title: "Welcome to PumpLedger Forecourt",
    titleHi: "PumpLedger में आपका स्वागत है",
    description:
      "Quick 20-second guide to recording credit slips fast from your phone or counter.",
    descriptionHi:
      "मोबाइल या काउंटर से तुरंत उधार पर्ची दर्ज करने का 20 सेकंड का आसान टूर।",
  },
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
    title: "Open Guide Anytime",
    titleHi: "कभी भी गाइड खोलें",
    description:
      "Tap Guide (?) anytime to switch between Hindi/English tutorials or replay this tour.",
    descriptionHi:
      "हिंदी/अंग्रेजी मदद या इस टूर को दोबारा देखने के लिए Guide (?) दबाएं।",
  },
];

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
  const navigate = useNavigate();
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

  const isHi = lang === "hi";
  const isOperator = user?.role === "OPERATOR";
  const steps = isOperator ? OPERATOR_STEPS : MANAGER_STEPS;
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];

  // Auto-launch once for first-time users on dashboard
  useEffect(() => {
    if (hasCompletedTour || focusMode || !user) return;
    const isEntryRoute =
      location.pathname === "/dashboard" ||
      (isOperator && location.pathname === "/dashboard/quick-entry");
    if (!isEntryRoute) return;

    const timer = window.setTimeout(() => {
      setStepIndex(0);
      setIsOpen(true);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [hasCompletedTour, focusMode, user, location.pathname, isOperator]);

  // Manual trigger event from Guide Drawer
  useEffect(() => {
    const handleStart = () => {
      if (!isOperator && location.pathname !== "/dashboard") {
        navigate("/dashboard");
      }
      setStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener("pumpledger:start-tour", handleStart);
    return () => window.removeEventListener("pumpledger:start-tour", handleStart);
  }, [isOperator, location.pathname, navigate]);

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

  // Switch mobile register view when step specifies Left vs Right page & re-measure
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

  // Measure rendered card height for clean placement
  useLayoutEffect(() => {
    if (cardRef.current) {
      const h = cardRef.current.getBoundingClientRect().height;
      if (h > 0) setCardHeight(h);
    }
  }, [isOpen, stepIndex, isHi]);

  const finishTour = useCallback(() => {
    setIsOpen(false);
    setHasCompletedTour(true);
  }, [setHasCompletedTour]);

  // Keyboard navigation (Esc / Left / Right)
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
    <div className="fixed inset-0 z-[100] pointer-events-auto no-print" role="dialog" aria-modal="true">
      {/* Dark Backdrop when centered welcome or fallback */}
      {!targetRect && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity"
          onClick={finishTour}
        />
      )}

      {/* Spotlight Cutout + Pulsing Ring around Target Element */}
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

      {/* Animated Pointing SVG Arrow connecting Card → Spotlight Target */}
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

      {/* Wizard Tooltip Card */}
      <div
        ref={cardRef}
        className="fixed z-[102] rounded-2xl border border-fuel-amber/50 bg-surface-1 p-4 shadow-2xl text-ink transition-all duration-300"
        style={{
          top: cardTop,
          left: cardLeft,
          width: cardWidth,
        }}
      >
        {/* Top Row: Badge + Lang Toggle + Close */}
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

        {/* Title & Explanation */}
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

        {/* Progress Dots + Navigation Buttons */}
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
