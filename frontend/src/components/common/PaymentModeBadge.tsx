const MODE_STYLES: Record<string, { label: string; cls: string }> = {
  CASH: {
    label: "CASH",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  UPI: {
    label: "UPI",
    cls: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  },
  CREDIT: {
    label: "CREDIT",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  BANK: {
    label: "BANK",
    cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  CARD: {
    label: "CARD",
    cls: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  },
  SPLIT: {
    label: "SPLIT",
    cls: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
  },
};

export function PaymentModeBadge({ mode }: { mode: string }) {
  const style = MODE_STYLES[mode?.toUpperCase()] ?? {
    label: mode || "—",
    cls: "bg-surface-2 text-ink-muted border-hairline",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold tracking-wide ${style.cls}`}
    >
      {style.label}
    </span>
  );
}
