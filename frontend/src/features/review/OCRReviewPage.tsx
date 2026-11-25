import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ChevronLeft, ChevronRight, SkipForward, CheckCircle2 } from "lucide-react";

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

  const total = batch.length;
  const savedCount = Object.values(statuses).filter((s) => s === "saved").length;

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
