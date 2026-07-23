import api from "@/api/client";
import { queryClient } from "@/lib/queryClient";

export interface QueuedTransaction {
  id: string;
  type: "VOUCHER" | "PAYMENT" | "METER_READING";
  endpoint: string;
  payload: any;
  timestamp: number;
  attempts: number;
  description: string;
}

const STORAGE_KEY = "pumpledger_offline_queue";

type QueueListener = (queue: QueuedTransaction[]) => void;
const listeners: Set<QueueListener> = new Set();

function notifyListeners(queue: QueuedTransaction[]) {
  listeners.forEach((listener) => listener(queue));
}

export function getOfflineQueue(): QueuedTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedTransaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyListeners(queue);
  } catch (e) {
    console.error("Failed to save offline queue", e);
  }
}

export function enqueueOfflineTransaction(
  type: QueuedTransaction["type"],
  endpoint: string,
  payload: any,
  description: string
): QueuedTransaction {
  const queue = getOfflineQueue();
  const newItem: QueuedTransaction = {
    id: `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    endpoint,
    payload,
    timestamp: Date.now(),
    attempts: 0,
    description,
  };

  queue.push(newItem);
  saveOfflineQueue(queue);
  return newItem;
}

export function removeOfflineTransaction(id: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== id);
  saveOfflineQueue(filtered);
}

export function subscribeOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let isSyncing = false;

export async function processOfflineQueue(): Promise<{
  successCount: number;
  failCount: number;
}> {
  if (isSyncing || !navigator.onLine) {
    return { successCount: 0, failCount: 0 };
  }

  isSyncing = true;
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    isSyncing = false;
    return { successCount: 0, failCount: 0 };
  }

  let successCount = 0;
  let failCount = 0;
  const remainingQueue: QueuedTransaction[] = [];

  for (const item of queue) {
    try {
      await api.post(item.endpoint, item.payload);
      successCount++;
    } catch (err: any) {
      // If 4xx validation error, don't retry forever — drop or log
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        console.error(`Offline item ${item.id} rejected by server with ${err.response.status}`, err);
        failCount++;
      } else {
        // Network or 5xx server error: keep in queue with incremented attempts
        item.attempts += 1;
        remainingQueue.push(item);
        failCount++;
      }
    }
  }

  saveOfflineQueue(remainingQueue);

  if (successCount > 0) {
    queryClient.invalidateQueries();
  }

  isSyncing = false;
  return { successCount, failCount };
}

// Automatically trigger sync when browser comes online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    processOfflineQueue();
  });
}
