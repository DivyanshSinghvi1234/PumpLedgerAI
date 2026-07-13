import { Inbox } from "lucide-react";

interface Props {
  message: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  message,
  action,
}: Props) {
  return (
    <div className="flex flex-col h-56 items-center justify-center rounded-xl border border-dashed border-hairline-strong bg-surface-1/50 p-12 text-center font-sans">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-3 border border-hairline text-ink-subtle mb-4">
        <Inbox size={22} />
      </div>
      <p className="text-sm font-medium text-ink-muted">
        {message}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}