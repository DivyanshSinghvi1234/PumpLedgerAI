import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, Compass, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { findGuideForPath, PAGE_GUIDES } from "./guideData";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InstructorDrawer({ open, onClose }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const currentGuide = findGuideForPath(location.pathname);
  const [selectedGuidePath, setSelectedGuidePath] = useState(currentGuide.path);
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    currentGuide.sections[0]?.id ?? null
  );

  useEffect(() => {
    const matched = findGuideForPath(location.pathname);
    setSelectedGuidePath(matched.path);
    setExpandedSectionId(matched.sections[0]?.id ?? null);
  }, [location.pathname, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const activeGuide =
    PAGE_GUIDES.find((g) => g.path === selectedGuidePath) || currentGuide;
  const isHi = lang === "hi";

  return createPortal(
    <div
      className="fixed inset-0 flex justify-end bg-black/50 backdrop-blur-xs"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-surface-1 border-l border-hairline shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-hairline bg-surface-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-fuel-amber/15 text-fuel-amber flex items-center justify-center">
              <Compass size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">
                {isHi ? "इंटरैक्टिव गाइड / ट्यूटोरियल" : "Interactive Guide & Tutorial"}
              </h2>
              <p className="text-[11px] text-ink-muted">
                {isHi
                  ? "किसी भी सेक्शन या हेडर पर क्लिक करके उसकी जानकारी देखें"
                  : "Click any section or header below to learn how it works"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-surface-3 text-ink-muted hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Page Switcher Pills */}
        <div className="shrink-0 px-4 py-2.5 border-b border-hairline bg-surface-2/50 flex gap-1.5 overflow-x-auto">
          {PAGE_GUIDES.map((g) => (
            <button
              key={g.path}
              type="button"
              onClick={() => {
                setSelectedGuidePath(g.path);
                setExpandedSectionId(g.sections[0]?.id ?? null);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap border cursor-pointer transition ${
                activeGuide.path === g.path
                  ? "bg-fuel-amber text-canvas border-fuel-amber"
                  : "bg-surface-1 text-ink-muted border-hairline hover:text-ink"
              }`}
            >
              {isHi ? g.titleHi : g.title}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Overview */}
          <div className="rounded-xl border border-hairline bg-surface-2 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <BookOpen size={15} className="text-fuel-amber" />
                {isHi ? activeGuide.titleHi : activeGuide.title}
              </h3>
              {location.pathname !== activeGuide.path && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(activeGuide.path);
                    onClose();
                  }}
                  className="text-[11px] font-semibold text-fuel-amber hover:underline cursor-pointer"
                >
                  {isHi ? "पेज खोलें →" : "Open Page →"}
                </button>
              )}
            </div>
            <p className="text-ink-muted leading-relaxed">
              {isHi ? activeGuide.overviewHi : activeGuide.overview}
            </p>
          </div>

          {/* Step-by-Step */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-[11px] text-ink-muted">
              {isHi ? "इस पेज पर क्या करें (Steps)" : "How to Use This Screen"}
            </h4>
            <ol className="space-y-2">
              {(isHi ? activeGuide.stepsHi : activeGuide.steps).map((s, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-2/60 px-3 py-2"
                >
                  <span className="h-5 w-5 rounded-full bg-fuel-amber/20 text-fuel-amber font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="text-ink leading-snug">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Clickable Headers / Tabs */}
          {activeGuide.sections.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[11px] text-ink-muted">
                {isHi
                  ? "टैब और हेडर (विस्तार से जानने के लिए क्लिक करें)"
                  : "Headers & Tabs (Click any header to inspect)"}
              </h4>
              <div className="space-y-2">
                {activeGuide.sections.map((sec) => {
                  const isOpen = expandedSectionId === sec.id;
                  return (
                    <div
                      key={sec.id}
                      className={`rounded-xl border transition ${
                        isOpen
                          ? "border-fuel-amber/50 bg-fuel-amber/5"
                          : "border-hairline bg-surface-2/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSectionId(isOpen ? null : sec.id)
                        }
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-ink">
                            {isHi ? sec.headerHi : sec.header}
                          </div>
                          <div className="text-[11px] text-ink-muted mt-0.5">
                            {isHi ? sec.summaryHi : sec.summary}
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronDown size={16} className="text-fuel-amber shrink-0" />
                        ) : (
                          <ChevronRight size={16} className="text-ink-muted shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-hairline/60 px-3.5 py-2.5 space-y-1.5 text-[11px] text-ink">
                          {(isHi ? sec.detailsHi : sec.details).map((d, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="text-fuel-amber font-bold">•</span>
                              <span>{d}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
