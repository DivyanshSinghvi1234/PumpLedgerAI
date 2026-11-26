import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronDown, ChevronRight, Compass } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const activeGuide =
    PAGE_GUIDES.find((g) => g.path === selectedGuidePath) || currentGuide;
  const isHi = lang === "hi";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b border-hairline shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Compass size={18} className="text-fuel-amber" />
            {isHi ? "इंटरैक्टिव गाइड / ट्यूटोरियल" : "Interactive Guide & Tutorial"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isHi
              ? "किसी भी सेक्शन या हेडर पर क्लिक करके उसकी जानकारी देखें"
              : "Click any page or header below to learn how it works"}
          </DialogDescription>
        </DialogHeader>

        {/* Page Switcher Pills */}
        <div className="shrink-0 px-4 py-2.5 border-b border-hairline flex gap-1.5 overflow-x-auto bg-muted/30">
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
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {isHi ? g.titleHi : g.title}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Overview */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
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
            <p className="text-muted-foreground leading-relaxed">
              {isHi ? activeGuide.overviewHi : activeGuide.overview}
            </p>
          </div>

          {/* Step-by-Step */}
          <div className="space-y-2">
            <h4 className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
              {isHi ? "इस पेज पर क्या करें (Steps)" : "How to Use This Screen"}
            </h4>
            <ol className="space-y-2">
              {(isHi ? activeGuide.stepsHi : activeGuide.steps).map((s, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <span className="h-5 w-5 rounded-full bg-fuel-amber/20 text-fuel-amber font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="leading-snug">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Clickable Headers / Tabs */}
          {activeGuide.sections.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-[11px] text-muted-foreground">
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
                          : "border-border bg-muted/20"
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
                          <div className="font-bold">
                            {isHi ? sec.headerHi : sec.header}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {isHi ? sec.summaryHi : sec.summary}
                          </div>
                        </div>
                        {isOpen ? (
                          <ChevronDown size={16} className="text-fuel-amber shrink-0" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="border-t border-border/60 px-3.5 py-2.5 space-y-1.5 text-[11px]">
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
      </DialogContent>
    </Dialog>
  );
}
