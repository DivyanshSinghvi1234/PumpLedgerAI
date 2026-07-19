import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="rounded-lg border border-hairline bg-surface-2 p-1.5 text-ink-muted"
        aria-label="Toggle theme"
        disabled
      >
        <Moon size={18} />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative rounded-lg border border-hairline bg-surface-2 p-1.5",
        "text-ink-muted hover:bg-surface-3 hover:text-ink",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuel-amber/50"
      )}
      aria-label="Toggle theme"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun
        className={cn("h-4 w-4 transition-all duration-300", isDark ? "rotate-90 scale-0" : "rotate-0 scale-100")}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          "absolute top-1.5 left-1.5 h-4 w-4 transition-all duration-300",
          isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0"
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
    </button>
  );
}