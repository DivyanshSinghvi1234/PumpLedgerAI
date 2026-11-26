import { Fuel } from "lucide-react";

interface LoadingStateProps {
  variant?: "spinner" | "table" | "cards";
  rows?: number;
}

export default function LoadingState({
  variant = "spinner",
  rows = 7,
}: LoadingStateProps) {
  if (variant === "table") {
    return (
      <div className="space-y-5 animate-pulse">
        {/* Page Header Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="skeleton h-6 w-44 rounded-lg" />
            <div className="skeleton h-3.5 w-64 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-9 w-28 rounded-lg" />
            <div className="skeleton h-9 w-32 rounded-lg" />
          </div>
        </div>

        {/* Toolbar Skeleton */}
        <div className="bento-card p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="skeleton h-9 w-64 rounded-lg" />
          <div className="flex gap-2">
            <div className="skeleton h-8 w-20 rounded-full" />
            <div className="skeleton h-8 w-20 rounded-full" />
            <div className="skeleton h-8 w-20 rounded-full" />
          </div>
        </div>

        {/* Table Rows Skeleton */}
        <div className="bento-card overflow-hidden">
          <div className="border-b border-hairline bg-surface-2/70 px-4 py-3 grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-3 w-20 rounded" />
            ))}
          </div>
          <div className="divide-y divide-hairline">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="px-4 py-3.5 grid grid-cols-5 gap-4 items-center">
                <div className="skeleton h-4 w-28 rounded" />
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-5 w-16 rounded-full" />
                <div className="skeleton h-4 w-20 rounded ml-auto" />
                <div className="skeleton h-7 w-16 rounded-lg ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bento-card p-5 space-y-3">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-7 w-32 rounded-lg" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

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
