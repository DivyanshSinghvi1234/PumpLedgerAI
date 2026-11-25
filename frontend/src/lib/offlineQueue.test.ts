import { beforeEach, describe, expect, it, vi } from "vitest";
import api from "@/api/client";
import {
  enqueueOfflineTransaction,
  getOfflineQueue,
  processOfflineQueue,
  removeOfflineTransaction,
  saveOfflineQueue,
} from "@/lib/offlineQueue";

vi.mock("@/api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

describe("offlineQueue", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("enqueues and removes offline transactions", () => {
    const item = enqueueOfflineTransaction(
      "VOUCHER",
      "/vouchers",
      { invoice_number: "INV-101", total_amount: 500 },
      "Diesel voucher ₹500"
    );

    expect(getOfflineQueue()).toHaveLength(1);
    expect(getOfflineQueue()[0].id).toBe(item.id);

    removeOfflineTransaction(item.id);
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it("does not sync when browser is offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    enqueueOfflineTransaction("PAYMENT", "/payments", { amount: 1000 }, "Payment");

    const result = await processOfflineQueue();

    expect(result).toEqual({ successCount: 0, failCount: 0 });
    expect(api.post).not.toHaveBeenCalled();
    expect(getOfflineQueue()).toHaveLength(1);
  });

  it("syncs queued transactions when online and clears them on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 1 } } as never);
    saveOfflineQueue([]);
    enqueueOfflineTransaction(
      "VOUCHER",
      "/vouchers",
      { invoice_number: "INV-202" },
      "Queued voucher"
    );

    const result = await processOfflineQueue();

    expect(result).toEqual({ successCount: 1, failCount: 0 });
    expect(api.post).toHaveBeenCalledWith("/vouchers", { invoice_number: "INV-202" });
    expect(getOfflineQueue()).toHaveLength(0);
  });
});
