import { useQuery } from "@tanstack/react-query";
import { Star, MessageSquare } from "lucide-react";

import api from "@/api/client";

interface FeedbackItem {
  date: string;
  phone: string | null;
  rating: number;
  feedback: string | null;
  voucher_number: string | null;
}

interface NPSData {
  nps_score: number;
  average_rating: number;
  total_ratings: number;
  rating_distribution: Record<number, number>;
  feedbacks: FeedbackItem[];
}

export default function NPSDashboardCard() {
  const { data, isLoading } = useQuery<NPSData>({
    queryKey: ["nps-analytics"],
    queryFn: async () => {
      const res = await api.get("/v1/nps/analytics");
      return res.data;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="card-glow rounded-xl border border-hairline bg-surface-1 p-6 h-[320px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-ink-subtle">Aggregating Net Promoter Score...</span>
        </div>
      </div>
    );
  }

  const { nps_score, average_rating, total_ratings, rating_distribution, feedbacks } = data;

  // Mask customer phone for privacy (e.g. +91******1234)
  const maskPhone = (phone: string | null) => {
    if (!phone) return "Anonymous Guest";
    const p = phone.trim();
    if (p.length <= 4) return p;
    return `${p.slice(0, p.length - 4)}****`;
  };

  // NPS Meter coordinates and gauge setup (value from -100 to 100)
  // Angle goes from 180 (left) to 0 (right) degrees.
  const npsPercent = (nps_score + 100) / 200; // 0 to 1

  // NPS Label color
  const getNPSColor = (score: number) => {
    if (score >= 50) return "text-emerald-500";
    if (score >= 10) return "text-blue-500";
    if (score >= 0) return "text-amber-500";
    return "text-error";
  };

  const feedbacksWithText = feedbacks.filter((f) => f.feedback && f.feedback.trim() !== "");

  return (
    <div className="card-glow rounded-xl border border-hairline bg-surface-1 p-6 transition-all duration-200">
      <div className="mb-6">
        <h2 className="text-base font-bold tracking-tight text-ink">
          Customer NPS & Feedback Feed
        </h2>
        <p className="text-xs text-ink-muted mt-0.5">
          Real-time Net Promoter Score and public star ratings feedback.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Arc Gauge for NPS */}
        <div className="flex flex-col items-center justify-center p-4 border border-hairline/40 rounded-xl bg-surface-2/20 text-center">
          <div className="relative w-36 h-24 flex items-center justify-center overflow-hidden">
            {/* SVG Arc Gauge */}
            <svg className="w-28 h-28 transform -rotate-180" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#27272a"
                strokeWidth="10"
                strokeDasharray="251.2"
                strokeDashoffset="125.6" // half circle
                strokeLinecap="round"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={nps_score >= 50 ? "#10b981" : nps_score >= 10 ? "#3b82f6" : nps_score >= 0 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10"
                strokeDasharray="251.2"
                strokeDashoffset={125.6 + (125.6 * (1 - npsPercent))} // Map to the half circle (125.6 to 251.2)
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/3 flex flex-col items-center">
              <span className={`text-3xl font-black font-mono leading-none ${getNPSColor(nps_score)}`}>
                {nps_score > 0 ? `+${Math.round(nps_score)}` : Math.round(nps_score)}
              </span>
              <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wider mt-1">
                NPS SCORE
              </span>
            </div>
          </div>
          <div className="text-xs text-ink-subtle mt-2">
            Average Rating: <span className="font-bold text-ink">{average_rating} ★</span> ({total_ratings} entries)
          </div>
        </div>

        {/* Stars distribution bar chart */}
        <div className="flex flex-col justify-between p-4 border border-hairline/40 rounded-xl bg-surface-2/20">
          <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">
            Star Distribution
          </h3>
          <div className="space-y-1.5 flex-1 flex flex-col justify-center">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = rating_distribution[stars] || 0;
              const percent = total_ratings > 0 ? (count / total_ratings) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 w-8">
                    <span className="text-xs font-bold font-mono text-ink-muted">{stars}</span>
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  </div>
                  <div className="flex-1 h-2 rounded bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-ink-subtle w-6 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* scrolling feed of feedback comments */}
        <div className="flex flex-col p-4 border border-hairline/40 rounded-xl bg-surface-2/20">
          <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Client Feedback Note Feed
          </h3>
          <div className="flex-1 max-h-[120px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {feedbacksWithText.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-xs text-ink-subtle italic py-6">
                No text reviews received yet.
              </div>
            ) : (
              feedbacksWithText.map((f, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-surface-3 border border-hairline text-left space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-ink-muted">
                      {maskPhone(f.phone)}
                    </span>
                    <span className="text-ink-subtle font-mono">
                      {f.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-2.5 w-2.5 ${i < f.rating ? "fill-amber-500" : "opacity-20"}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink text-normal leading-relaxed break-words">
                    "{f.feedback}"
                  </p>
                  {f.voucher_number && (
                    <div className="text-[9px] text-ink-subtle font-mono">
                      Voucher: {f.voucher_number}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
