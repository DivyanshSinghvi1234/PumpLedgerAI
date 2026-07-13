import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;

  value: string | number;

  icon: LucideIcon;

  accent?: string;
  iconBg?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  accent = "text-fuel-amber",
  iconBg = "bg-fuel-amber/10",
}: Props) {
  return (
    <div className="card-glow group rounded-xl border border-hairline bg-surface-1 p-5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-ink-subtle uppercase tracking-wide">
            {title}
          </p>

          <p className="text-2xl font-bold tracking-tight text-ink">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${accent} transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
