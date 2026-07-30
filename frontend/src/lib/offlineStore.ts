export interface OfflineVoucherItem {
  id: string; // client-generated temporary UUID
  createdAt: string;
  payload: any;
}

const STORAGE_KEY = "pumpledger_offline_vouchers_queue";

export class OfflineStore {
  getQueuedVouchers(): OfflineVoucherItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  queueVoucher(payload: any): OfflineVoucherItem {
    const queue = this.getQueuedVouchers();
    const newItem: OfflineVoucherItem = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      payload,
    };
    queue.push(newItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    return newItem;
  }

  removeVoucher(id: string): void {
    const queue = this.getQueuedVouchers().filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }

  clearQueue(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  async syncQueue(
    postVoucherFn: (payload: any) => Promise<any>
  ): Promise<{ synced: number; failed: number }> {
    const queue = this.getQueuedVouchers();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;
    const remaining: OfflineVoucherItem[] = [];

    for (const item of queue) {
      try {
        await postVoucherFn(item.payload);
        synced++;
      } catch (err) {
        failed++;
        remaining.push(item);
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    return { synced, failed };
  }
}

export const offlineStore = new OfflineStore();
