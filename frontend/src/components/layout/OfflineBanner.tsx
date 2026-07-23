import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useOnlineStatus();

  // If online and no items queued, render nothing
  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-all duration-300 ${
        !isOnline
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-b border-amber-500/20"
          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff size={16} className="text-amber-500 animate-pulse" />
            <span>
              <strong>Offline Mode</strong> — Connections offline or cold start. {pendingCount} item{pendingCount === 1 ? "" : "s"} queued for background sync.
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 size={16} className="text-emerald-500" />
            <span>
              Connected. {pendingCount} queued item{pendingCount === 1 ? "" : "s"} ready to sync.
            </span>
          </>
        )}
      </div>

      {pendingCount > 0 && isOnline && (
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-surface-4 text-ink transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </button>
      )}
    </div>
  );
}
