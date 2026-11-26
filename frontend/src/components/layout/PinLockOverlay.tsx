import { useState } from "react";
import { Lock, Delete } from "lucide-react";
import { usePreferences } from "@/lib/preferences";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";

interface Props {
  locked: boolean;
  onUnlock: () => void;
}

export function PinLockOverlay({ locked, onUnlock }: Props) {
  const { pinCode } = usePreferences();
  const { user } = useCurrentUser();
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  if (!locked) return null;

  const pushDigit = (d: string) => {
    if (entered.length >= 4) return;
    const next = entered + d;
    setEntered(next);
    setError(false);
    if (next.length === 4) {
      if (next === (pinCode || "1234")) {
        setEntered("");
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setEntered(""), 450);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-canvas/95 backdrop-blur-md p-4"
      style={{ zIndex: 10000 }}
    >
      <div className="w-full max-w-xs rounded-2xl border border-hairline bg-surface-1 p-6 shadow-2xl text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-fuel-amber/15 text-fuel-amber flex items-center justify-center">
          <Lock size={22} />
        </div>
        <div>
          <h2 className="text-base font-bold text-ink">Shift Quick-Switch Lock</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            {user?.full_name || user?.username} · Enter 4-digit PIN (default: 1234)
          </p>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full border transition ${
                error
                  ? "bg-rose-500 border-rose-500"
                  : i < entered.length
                  ? "bg-fuel-amber border-fuel-amber"
                  : "border-hairline bg-surface-2"
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => pushDigit(n)}
              className="h-12 rounded-xl border border-hairline bg-surface-2 text-base font-mono font-bold text-ink hover:bg-surface-3 cursor-pointer"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEntered("")}
            className="h-12 rounded-xl border border-hairline bg-surface-2 text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => pushDigit("0")}
            className="h-12 rounded-xl border border-hairline bg-surface-2 text-base font-mono font-bold text-ink hover:bg-surface-3 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setEntered((p) => p.slice(0, -1))}
            className="h-12 rounded-xl border border-hairline bg-surface-2 flex items-center justify-center text-ink-muted hover:text-ink cursor-pointer"
          >
            <Delete size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
