import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { offlineStore } from "@/lib/offlineStore";
import voucherService from "@/features/vouchers/services/voucherService";

export default function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(() => offlineStore.getQueuedVouchers().length);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateStatus = () => {
    setIsOnline(navigator.onLine);
    setQueueCount(offlineStore.getQueuedVouchers().length);
  };

  const handleSync = async () => {
    if (!navigator.onLine) {
      toast.error("Still offline. Cannot sync yet.");
      return;
    }
    const count = offlineStore.getQueuedVouchers().length;
    if (count === 0) return;

    setIsSyncing(true);
    try {
      const res = await offlineStore.syncQueue((payload) => voucherService.create(payload));
      if (res.synced > 0) {
        toast.success(`Successfully synced ${res.synced} offline slips!`);
      }
      if (res.failed > 0) {
        toast.error(`Failed to sync ${res.failed} slips. Retrying on next connection.`);
      }
    } finally {
      setIsSyncing(false);
      updateStatus();
    }
  };

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      toast.success("Network connection restored!");
      handleSync();
    };

    const onOffline = () => {
      setIsOnline(false);
      toast.warning("Network connection lost. Offline Forecourt Mode active.");
      updateStatus();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(updateStatus, 3000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && queueCount === 0) {
    return null;
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-xs font-semibold flex items-center justify-between shadow-lg transition-colors ${
        !isOnline
          ? "bg-amber-500 text-black"
          : "bg-emerald-600 text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <WifiOff size={16} className="animate-pulse" />
        ) : (
          <CheckCircle2 size={16} />
        )}
        <span>
          {!isOnline
            ? `📡 Offline Forecourt Mode Active — ${queueCount} slip(s) queued locally in browser`
            : `🟢 Online Mode Restored — ${queueCount} slip(s) pending background sync`}
        </span>
      </div>

      {isOnline && queueCount > 0 && (
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncing..." : "Sync Now"}
        </button>
      )}
    </div>
  );
}
