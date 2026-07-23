import { useState, useEffect } from "react";
import {
  getOfflineQueue,
  subscribeOfflineQueue,
  processOfflineQueue,
  type QueuedTransaction,
} from "@/lib/offlineQueue";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const [queue, setQueue] = useState<QueuedTransaction[]>(getOfflineQueue);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = subscribeOfflineQueue((updatedQueue) => {
      setQueue([...updatedQueue]);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      await processOfflineQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isOnline,
    pendingCount: queue.length,
    pendingQueue: queue,
    isSyncing,
    triggerSync,
  };
}
