import { Fuel } from "lucide-react";

export default function LoadingState() {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 border border-hairline text-fuel-amber">
          <Fuel size={20} className="animate-pulse" />
        </div>
      </div>
      <div className="space-y-2 w-48">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-3/4 rounded mx-auto" />
      </div>
    </div>
  );
}