import { useState, useRef, useEffect } from "react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { Building2, ChevronDown, Check } from "lucide-react";

export default function PumpSwitcher() {
  const { pumps, activePump, switchPump } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!activePump) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-muted bg-surface-2/40 rounded-lg border border-hairline">
        <Building2 size={14} className="text-ink-subtle" />
        <span>No pump selected</span>
      </div>
    );
  }

  const hasMultiplePumps = pumps.length > 1;

  return (
    <div className="relative w-full font-sans" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={!hasMultiplePumps}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all duration-200 ${
          hasMultiplePumps
            ? "border-hairline bg-surface-2/65 hover:bg-surface-3/85 text-ink hover:text-ink-strong cursor-pointer shadow-sm hover:shadow"
            : "border-hairline/50 bg-surface-2/30 text-ink-muted cursor-default"
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-fuel-amber/10 text-fuel-amber">
            <Building2 size={12} />
          </div>
          <span className="truncate text-left font-medium tracking-tight">
            {activePump.name}
          </span>
        </div>
        {hasMultiplePumps && (
          <ChevronDown
            size={14}
            className={`text-ink-subtle shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-ink" : ""
            }`}
          />
        )}
      </button>

      {/* Dropdown Options List */}
      {isOpen && hasMultiplePumps && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-hairline bg-surface-1/95 p-1 text-ink shadow-lg backdrop-blur-md animate-fade-in-up origin-top-left">
          <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-tertiary">
            Switch Filling Station
          </div>
          <div className="h-px bg-hairline my-1" />
          <div className="space-y-0.5">
            {pumps.map((pump) => {
              const isSelected = pump.uuid === activePump.uuid;
              return (
                <button
                  key={pump.uuid}
                  type="button"
                  onClick={() => {
                    switchPump(pump.uuid);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-fuel-amber/10 text-fuel-amber font-semibold"
                      : "text-ink hover:bg-surface-3/70 hover:text-ink-strong"
                  }`}
                >
                  <span className="truncate">{pump.name}</span>
                  {isSelected && <Check size={12} className="text-fuel-amber shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
