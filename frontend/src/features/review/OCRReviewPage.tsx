import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, SkipForward, CheckCircle2, Zap } from "lucide-react";
import { toast } from "sonner";

import api from "@/api/client";
import OCRReviewForm from "./components/OCRReviewForm";

type ReviewStatus = "pending" | "saved" | "skipped";

export default function OCRReviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateObj = location.state as { batch?: unknown[] } | null;
  const batch = Array.isArray(stateObj?.batch)
    ? stateObj.batch
    : location.state
      ? [location.state]
      : [];

  const [reviewIndex, setReviewIndex] = useState(0);
  const [statuses, setStatuses] = useState<Record<number, ReviewStatus>>({});
  const queryClient = useQueryClient();

  const total = batch.length;
  const savedCount = Object.values(statuses).filter((s) => s === "saved").length;

  const eligiblePendingEntries = batch
    .map((item: any, idx: number) => ({ item, idx }))
    .filter(({ item, idx }) => {
      if ((statuses[idx] ?? "pending") !== "pending") return false;
      const conf = Number(item?.ocr?.confidence ?? 0);
      const errs = item?.validation?.errors ?? [];
      return conf >= 0.9 && errs.length === 0;
    });

  const bulkApproveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{
        approved_count: number;
        skipped_count: number;
        approved_indices: number[];
      }>("/v1/vouchers/bulk-approve-ocr", {
        items: eligiblePendingEntries.map((e) => e.item),
        min_confidence: 0.9,
      });
      return res.data;
    },
    onSuccess: (data) => {
      const updated: Record<number, ReviewStatus> = { ...statuses };
      for (const localIdx of data.approved_indices) {
        const origIdx = eligiblePendingEntries[localIdx]?.idx;
        if (origIdx !== undefined) {
          updated[origIdx] = "saved";
        }
      }
      setStatuses(updated);
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(
        `Auto-approved ${data.approved_count} high-confidence slip(s)` +
          (data.skipped_count > 0 ? ` · ${data.skipped_count} kept for manual review` : "")
      );
      moveToNextPending(-1, updated);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Bulk approve failed");
    },
  });

  function moveToNextPending(fromIndex: number, updated: Record<number, ReviewStatus>) {
    for (let i = fromIndex + 1; i < total; i++) {
      if ((updated[i] ?? "pending") === "pending") {
        setReviewIndex(i);
        return;
      }
    }
    for (let i = 0; i < fromIndex; i++) {
      if ((updated[i] ?? "pending") === "pending") {
        setReviewIndex(i);
        return;
      }
    }
    navigate("/dashboard/vouchers");
  }

  function handleSaved() {
    const updated = { ...statuses, [reviewIndex]: "saved" as ReviewStatus };
    setStatuses(updated);
    moveToNextPending(reviewIndex, updated);
  }

  function handleSkip() {
    const updated = { ...statuses, [reviewIndex]: "skipped" as ReviewStatus };
    setStatuses(updated);
    if (reviewIndex + 1 < total) {
      setReviewIndex(reviewIndex + 1);
    } else {
      navigate("/dashboard/vouchers");
    }
  }

  if (total === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">OCR Review</h1>
        <p className="text-sm text-muted-foreground">
          No slips in review queue. Upload invoice images to get started.
        </p>
      </div>
    );
  }

  const currentStatus = statuses[reviewIndex] ?? "pending";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">OCR Review</h1>
          {total > 1 && (
            <p className="text-sm text-muted-foreground mt-1">
              Slip {reviewIndex + 1} of {total} · {savedCount} saved
            </p>
          )}
        </div>

        {total > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {eligiblePendingEntries.length > 0 && (
              <button
                type="button"
                disabled={bulkApproveMutation.isPending}
                onClick={() => bulkApproveMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <Zap className="h-4 w-4" />
                {bulkApproveMutation.isPending
                  ? "Approving..."
                  : `Bulk Approve Eligible (${eligiblePendingEntries.length})`}
              </button>
            )}
            <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize">
              {currentStatus === "saved" && (
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />
              )}
              {currentStatus}
            </span>
            <button
              type="button"
              onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
              disabled={reviewIndex === 0}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm"
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </button>
            <button
              type="button"
              onClick={() => setReviewIndex((i) => Math.min(total - 1, i + 1))}
              disabled={reviewIndex === total - 1}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <OCRReviewForm
        key={reviewIndex}
        data={batch[reviewIndex]}
        onSaved={handleSaved}
      />
    </div>
  );
}
