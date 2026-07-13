import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fuel, Eye, EyeOff } from "lucide-react";
import { login } from "./services/authService";

export default function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await login({ username, password });

      navigate("/dashboard");
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : String(err);
      if (msg.includes("Network Error") || msg.includes("fetch")) {
        setError("Cannot reach the server. Make sure the backend is running on port 8000.");
      } else if (msg.includes("401") || msg.includes("Invalid")) {
        setError("Invalid username or password. Please try again.");
      } else {
        setError(msg || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen font-sans items-center justify-center bg-canvas overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-12%] left-[-8%] w-[700px] h-[700px] rounded-full bg-fuel-amber/8 blur-[160px]" />
        <div className="absolute bottom-[-12%] right-[-8%] w-[600px] h-[600px] rounded-full bg-fuel-orange/6 blur-[130px]" />
        <div className="absolute inset-0 dot-grid opacity-35" />
      </div>

      <div className="relative w-full max-w-2xl mx-auto px-4 py-10 z-10">
        {/* Brand header */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-fuel-amber to-fuel-orange text-canvas shadow-xl shadow-fuel-amber/30">
            <Fuel size={36} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">PumpLedger AI</h1>
          <p className="text-xs md:text-sm font-mono text-fuel-amber uppercase tracking-widest mt-2">Fuel Management Platform</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] items-stretch">
          {/* Left decorative panel */}
          <div className="hidden md:block rounded-2xl border border-hairline bg-surface-1 p-8 shadow-xl overflow-hidden relative">
            <div className="absolute -top-20 -left-24 w-64 h-64 rounded-full bg-fuel-amber/10 blur-[60px]" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-fuel-orange/10 blur-[60px]" />

            <div className="relative">
              <h2 className="text-2xl font-bold text-ink">Welcome back</h2>
              <p className="mt-3 text-ink-muted leading-relaxed">
                Sign in to access your ledger, vouchers, payments, and reporting.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuel-amber/10 border border-hairline">
                    <span className="h-2 w-2 rounded-full bg-fuel-amber" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Fast operations</p>
                    <p className="text-xs text-ink-tertiary">Quick search & streamlined workflows.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuel-orange/10 border border-hairline">
                    <span className="h-2 w-2 rounded-full bg-fuel-orange" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Clean audit trail</p>
                    <p className="text-xs text-ink-tertiary">Track changes across customers & vouchers.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuel-orange/10 border border-hairline">
                    <span className="h-2 w-2 rounded-full bg-fuel-orange" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Smart insights</p>
                    <p className="text-xs text-ink-tertiary">Daily sales, totals, and ledger summaries.</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-xl border border-hairline bg-surface-2/40 p-5">
                <p className="text-xs font-mono text-ink-tertiary">Demo credentials</p>
                <p className="mt-2 text-sm text-ink">
                  <span className="text-ink-subtle font-medium">admin</span> /{' '}
                  <span className="text-ink-subtle font-medium">admin123</span>
                </p>
              </div>
            </div>
          </div>

          {/* Login card */}
          <div className="rounded-2xl border border-hairline bg-surface-1 p-8 shadow-xl">
            <div className="mb-6 md:mb-8 text-center">
              <h2 className="text-2xl font-bold text-ink">Sign in</h2>
              <p className="text-base text-ink-muted mt-2">Enter your username and password</p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl bg-error-muted border border-error/25 px-5 py-4 text-sm font-medium text-error flex items-start gap-3">
                <span className="mt-0.5 flex h-2 w-2 rounded-full bg-error shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink-muted uppercase tracking-wide">
                  Username
                </label>
                <input
                  className="w-full rounded-2xl border border-hairline bg-surface-2 px-5 py-5 text-base text-ink outline-none transition input-glow focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20 placeholder:text-ink-tertiary"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                  inputMode="text"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink-muted uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-2xl border border-hairline bg-surface-2 px-5 py-5 text-base text-ink outline-none transition input-glow focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20 placeholder:text-ink-tertiary pr-14"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="shine w-full h-14 md:h-16 flex items-center justify-center rounded-2xl bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber text-canvas text-base font-bold disabled:opacity-50 transition-all shadow-lg shadow-fuel-amber/25 hover:shadow-fuel-amber/35 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-3">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-tertiary md:hidden">
              Demo credentials: <span className="text-ink-subtle font-medium">admin</span> / <span className="text-ink-subtle font-medium">admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
