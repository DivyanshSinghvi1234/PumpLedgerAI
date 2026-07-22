import { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Star, CheckCircle, AlertCircle, Sparkles } from "lucide-react";

export default function RatingPage() {
  const { token } = useParams<{ token: string }>();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setErrorMessage("Please select a star rating first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const baseUrl = import.meta.env.VITE_API_BASE_URL
      ? `${import.meta.env.VITE_API_BASE_URL}/api`
      : "/api";

    try {
      await axios.post(`${baseUrl}/v1/nps/rate/${token}`, {
        rating,
        feedback: feedback.trim() || null,
      });
      setIsSuccess(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to submit feedback. The link may have expired.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md card-glow rounded-2xl border border-hairline bg-surface-1/60 backdrop-blur-md p-6 sm:p-8 relative">
        {isSuccess ? (
          <div className="text-center space-y-4 py-8 animate-fade-in">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Thank You!
            </h1>
            <p className="text-sm text-ink-muted max-w-sm mx-auto leading-relaxed">
              Your rating and comments have been registered. We appreciate you taking the time to share your feedback.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-3 border border-hairline text-[10px] font-bold text-primary tracking-wider uppercase">
                <Sparkles className="h-3 w-3" /> Customer Feedback
              </div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                How was your experience?
              </h1>
              <p className="text-xs text-ink-muted">
                Your rating helps us keep the fuel high-quality and service fast.
              </p>
            </div>

            {/* Stars Selector */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = hoverRating ? star <= hoverRating : star <= rating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-all duration-150 hover:scale-110 active:scale-95 focus:outline-none"
                    >
                      <Star
                        className={`h-8 w-8 transition ${
                          isActive
                            ? "text-amber-500 fill-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]"
                            : "text-zinc-600 hover:text-zinc-500"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="h-4 text-[10px] font-bold font-mono text-ink-subtle uppercase tracking-widest">
                {hoverRating === 1 || rating === 1 ? "Very Poor" : ""}
                {hoverRating === 2 || rating === 2 ? "Poor" : ""}
                {hoverRating === 3 || rating === 3 ? "Neutral" : ""}
                {hoverRating === 4 || rating === 4 ? "Good" : ""}
                {hoverRating === 5 || rating === 5 ? "Excellent!" : ""}
              </div>
            </div>

            {/* Feedback text area */}
            <div className="space-y-1.5">
              <label htmlFor="feedback" className="text-xs font-semibold text-ink-muted">
                Any comments or suggestions? (Optional)
              </label>
              <textarea
                id="feedback"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share details of your experience (e.g. nozzle speed, customer care, pricing correctness)..."
                className="w-full rounded-xl border border-hairline bg-surface-2 p-3 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition"
                maxLength={1000}
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-lg border border-error/25 bg-error/10 p-3 text-xs text-error font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold tracking-tight hover:brightness-110 active:brightness-95 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Submitting Feedback...
                </>
              ) : (
                "Submit Rating"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
