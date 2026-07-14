import { useNavigate } from "react-router-dom";
import { ShieldX, ArrowLeft } from "lucide-react";

export default function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-error/10 border border-error/20">
        <ShieldX size={36} className="text-error" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-ink mb-2">Access Denied</h1>

      <p className="text-ink-muted max-w-md mb-8 leading-relaxed">
        You don't have permission to view this page. Contact your administrator
        if you believe this is an error.
      </p>

      {/* Back button */}
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber text-canvas px-6 py-3 text-sm font-bold transition-all shadow-lg shadow-fuel-amber/25 hover:shadow-fuel-amber/35 cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>
    </div>
  );
}
