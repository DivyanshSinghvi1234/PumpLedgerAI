import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Fuel,
  Upload,
  FileText,
  FileCode,
  ArrowRight,
  Check,
  ChevronRight,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { isAuthenticated } from "../auth/services/authService";

export default function LandingPage() {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Interactive OCR preview simulation state
  const [ocrStep, setOcrStep] = useState<"idle" | "uploading" | "ocr" | "matching" | "done">("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>;
    if (ocrStep === "uploading") {
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setOcrStep("ocr");
            return 100;
          }
          return prev + 10;
        });
      }, 80);
    } else if (ocrStep === "ocr") {
      timer = setTimeout(() => {
        setOcrStep("matching");
      }, 1000);
    } else if (ocrStep === "matching") {
      timer = setTimeout(() => {
        setOcrStep("done");
      }, 1000);
    }
    return () => {
      clearInterval(timer);
      clearTimeout(timer);
    };
  }, [ocrStep]);

  const startSimulation = () => {
    setProgress(0);
    setOcrStep("uploading");
  };

  return (
    <div className="relative min-h-screen bg-canvas text-ink overflow-x-hidden font-sans">
      {/* ── Warm gradient background ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[700px] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-fuel-amber/6 blur-[120px]" />
        <div className="absolute top-[10%] right-[15%] w-[400px] h-[400px] rounded-full bg-fuel-orange/5 blur-[100px]" />
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-canvas to-transparent" />
      </div>

      {/* ── Navigation Bar ── */}
      <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuel-amber to-fuel-orange text-canvas shadow-md shadow-fuel-amber/20">
              <Fuel size={16} strokeWidth={2.5} />
            </div>
            <span className="font-sans text-sm font-bold tracking-tight text-ink">
              PumpLedger AI
            </span>
          </div>

          <nav className="hidden items-center gap-8 md:flex text-xs font-medium text-ink-muted">
            <a href="#features" className="hover:text-ink transition">Features</a>
            <a href="#demo" className="hover:text-ink transition">Interactive Demo</a>
            <a href="#pricing" className="hover:text-ink transition">Pricing</a>
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            {loggedIn ? (
              <button
                onClick={() => navigate("/dashboard")}
                className="shine flex h-9 items-center rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber px-5 text-xs font-bold text-canvas transition shadow-md shadow-fuel-amber/20 cursor-pointer"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex h-9 items-center rounded-lg border border-hairline bg-surface-1 px-5 text-xs font-medium text-ink hover:bg-surface-2 transition"
                >
                  Log In
                </Link>
                <Link
                  to="/login"
                  className="shine flex h-9 items-center rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber px-5 text-xs font-bold text-canvas transition shadow-md shadow-fuel-amber/20 cursor-pointer"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-1.5 hover:bg-surface-3 md:hidden text-ink cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-x-0 top-16 z-50 bg-canvas border-b border-hairline py-6 px-6 flex flex-col gap-4 md:hidden shadow-xl animate-fade-in-up">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-ink-muted hover:text-ink transition">Features</a>
            <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-ink-muted hover:text-ink transition">Interactive Demo</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-ink-muted hover:text-ink transition">Pricing</a>
            <hr className="border-hairline my-2" />
            {loggedIn ? (
              <button
                onClick={() => { setMobileMenuOpen(false); navigate("/dashboard"); }}
                className="w-full flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange text-sm font-bold text-canvas transition cursor-pointer"
              >
                Go to Dashboard
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full flex h-10 items-center justify-center rounded-lg border border-hairline bg-surface-1 text-sm font-semibold text-ink hover:bg-surface-2 transition">Log In</Link>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange text-sm font-bold text-canvas transition cursor-pointer">Start Free</Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Hero Section ── */}
      <section className="relative mx-auto max-w-5xl px-6 pt-24 pb-16 text-center z-10">
        {/* Banner pill */}
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-1/80 backdrop-blur-sm px-4 py-1.5 text-[11px] font-mono text-ink-muted shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-fuel-amber animate-pulse" />
          <span>Introducing PumpLedger AI v1.0</span>
          <span className="text-ink-tertiary">·</span>
          <span className="text-fuel-amber font-semibold">AI-driven fueling ops</span>
        </div>

        {/* Hero Title */}
        <h1 className="font-sans text-4xl font-bold tracking-[-1.8px] text-ink sm:text-6xl sm:leading-[1.10] max-w-3xl mx-auto">
          Transform your fuel ledger with{" "}
          <span className="gradient-text">AI-driven clarity.</span>
        </h1>

        {/* Lead */}
        <p className="mx-auto mt-6 max-w-xl text-sm md:text-base text-ink-muted leading-relaxed">
          Instantly digitize hand-written delivery vouchers, reconcile credit customers,
          and sync records directly to Tally Prime. Real-time petrol pump bookkeeping, automated.
        </p>

        {/* Hero CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(loggedIn ? "/dashboard" : "/login")}
            className="shine w-full sm:w-auto flex h-11 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber px-7 text-sm font-bold text-canvas transition shadow-lg shadow-fuel-amber/20 cursor-pointer"
          >
            Start Deploying
            <ArrowRight size={16} />
          </button>
          <a
            href="#features"
            className="w-full sm:w-auto flex h-11 items-center justify-center rounded-lg border border-hairline bg-surface-1 px-7 text-sm font-semibold text-ink hover:bg-surface-2 transition"
          >
            Explore Features
          </a>
        </div>
      </section>

      {/* ── Brand logo marquee ── */}
      <section className="border-y border-hairline bg-surface-1/30 py-6 z-10 relative">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-[10px] font-mono uppercase tracking-widest text-ink-tertiary mb-4">
            Supports major oil distributors & fleets
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-xs font-semibold tracking-tight text-ink-tertiary">
            {["IndianOil", "Bharat Petroleum", "HP Lubricants", "Reliance Petroleum", "Shell Fuel Station"].map((name) => (
              <span key={name} className="hover:text-ink-muted transition cursor-default opacity-40 hover:opacity-70">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── App UI Mockup Panel ── */}
      <section className="mx-auto max-w-5xl px-6 py-12 z-10 relative">
        <div className="gradient-border shadow-2xl shadow-fuel-amber/5">
          <div className="rounded-xl bg-surface-1 p-3 md:p-4">
            <div className="rounded-lg border border-hairline bg-canvas overflow-hidden">
              {/* Mock Title Bar */}
              <div className="flex h-11 items-center justify-between border-b border-hairline bg-surface-1 px-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-error/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-fuel-amber/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                  <span className="ml-3 font-mono text-[10px] text-ink-subtle">pump-ledger-dashboard</span>
                </div>
                <div className="badge-success flex h-5 items-center px-2.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider">
                  Reconciled
                </div>
              </div>

              {/* Mock Interface */}
              <div className="grid grid-cols-1 md:grid-cols-4 min-h-[300px] text-xs">
                {/* Mock Sidebar */}
                <div className="hidden md:block border-r border-hairline bg-surface-1 p-3 space-y-4">
                  <div className="h-4 w-16 skeleton rounded-sm" />
                  <div className="space-y-1.5">
                    <div className="h-7 w-full bg-fuel-amber/10 border border-fuel-amber/20 rounded-md" />
                    <div className="h-7 w-full bg-transparent rounded-md" />
                    <div className="h-7 w-full bg-transparent rounded-md" />
                  </div>
                </div>
                {/* Mock Content */}
                <div className="md:col-span-3 p-4 bg-canvas space-y-4">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-ink">Recent OCR Vouchers</h4>
                      <p className="text-[10px] text-ink-subtle">Ingested via Gemini OCR pipeline</p>
                    </div>
                    <div className="h-6 w-20 bg-gradient-to-r from-fuel-amber to-fuel-orange rounded-md" />
                  </div>
                  <div className="space-y-2">
                    {[
                      { id: "#PL-9028", plate: "DL-1GC-4530", amount: "₹11,100.00" },
                      { id: "#PL-9027", plate: "HR-55B-8831", amount: "₹8,450.00" },
                      { id: "#PL-9026", plate: "MH-02A-1209", amount: "₹15,200.00" },
                    ].map((v) => (
                      <div key={v.id} className="flex justify-between border border-hairline bg-surface-1 p-2.5 rounded-lg hover:border-hairline-strong transition">
                        <span className="text-ink-muted">{v.id} · {v.plate}</span>
                        <span className="font-mono text-fuel-amber font-bold">{v.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Features ── */}
      <section id="features" className="mx-auto max-w-5xl px-6 py-20 z-10 relative">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fuel-amber mb-2">Automated Workflow</p>
          <h2 className="text-3xl font-bold tracking-[-0.8px] text-ink">
            Engineered for high-volume fueling records.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-muted">
            Replaces loose sheets, clipboards, and manual data-entry with a secure pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 stagger-children">
          {[
            {
              icon: Upload,
              title: "AI OCR Ingestion",
              desc: "Extract receipt numbers, fuel type, volume, unit rates, vehicle numbers, and customer signatures in real-time. Handles low-light mobile phone photos.",
              color: "text-petrol-blue",
              bg: "bg-petrol-blue/10",
            },
            {
              icon: FileText,
              title: "Auto Ledger Reconciliation",
              desc: "Match incoming vouchers to customer credit limits. Flag over-limit requests, compute vehicle fuel efficiencies, and keep balance statements reconciled instantly.",
              color: "text-fuel-amber",
              bg: "bg-fuel-amber/10",
            },
            {
              icon: FileCode,
              title: "Tally Sync Export",
              desc: "Generate error-free XML formats representing daily sales summaries, credit settlements, and fuel stock reports. Load directly into Tally Prime without retyping.",
              color: "text-success",
              bg: "bg-success/10",
            },
          ].map((f) => {
            const Ic = f.icon;
            return (
              <div key={f.title} className="card-glow rounded-xl border border-hairline bg-surface-1 p-6">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${f.bg} ${f.color} mb-5`}>
                  <Ic size={18} />
                </div>
                <h3 className="text-sm font-bold tracking-tight text-ink">{f.title}</h3>
                <p className="mt-2 text-xs text-ink-muted leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Interactive OCR Demo ── */}
      <section id="demo" className="border-t border-hairline bg-surface-1/20 py-20 z-10 relative">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-12">
            <span className="font-mono text-[9px] uppercase tracking-widest text-fuel-amber bg-fuel-amber/10 border border-fuel-amber/20 px-3 py-1 rounded-full font-semibold">
              Live Interactive Simulation
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.8px] text-ink">
              Watch Gemini OCR extract data in real time.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-xs text-ink-muted">
              Click the simulate button to trace how raw voucher slips transform into customer ledger rows.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left side: Simulated Slip */}
            <div className="lg:col-span-5 rounded-xl border border-hairline bg-surface-1 p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-3">Input Document</p>
                <div className="relative aspect-[3/4] w-full rounded-lg border border-hairline bg-canvas flex flex-col items-center justify-center overflow-hidden p-4">
                  {ocrStep === "idle" ? (
                    <div className="text-center p-4">
                      <Fuel size={36} className="mx-auto text-fuel-amber/40 mb-3 animate-pulse" />
                      <p className="text-xs font-semibold text-ink">Ready for Ingestion</p>
                      <p className="text-[10px] text-ink-subtle mt-1">Simulated hand-written fuel delivery slip</p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col justify-between text-left relative font-mono text-[9px] text-ink-muted">
                      <div className="border-b border-dashed border-hairline pb-2 mb-2">
                        <p className="font-bold text-center text-xs text-ink">JAI DURGE FUEL STATION</p>
                        <p className="text-center text-[8px]">NH-44 Highway, Sector-3, Delhi</p>
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <p><span className="text-ink-tertiary">INV:</span> #PL-9028</p>
                        <p><span className="text-ink-tertiary">DATE:</span> 2026-07-13</p>
                        <p><span className="text-ink-tertiary">VEH:</span> DL-1GC-4530</p>
                        <p><span className="text-ink-tertiary">CUST:</span> R.K. Transport Corp.</p>
                        <p><span className="text-ink-tertiary">TYPE:</span> DIESEL</p>
                        <p><span className="text-ink-tertiary">QTY:</span> 120.00 Ltrs</p>
                        <p><span className="text-ink-tertiary">RATE:</span> Rs. 92.50</p>
                        <p><span className="text-ink-tertiary">TOTAL:</span> Rs. 11,100.00</p>
                        <p><span className="text-ink-tertiary">MODE:</span> CREDIT</p>
                      </div>
                      <div className="border-t border-dashed border-hairline pt-2 mt-2">
                        <p className="text-[8px] italic text-center">Driver Signature Verified</p>
                      </div>

                      {/* Scanner overlays */}
                      {ocrStep === "uploading" && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-[1px]">
                          <div className="h-0.5 w-full bg-fuel-amber absolute top-0 left-0 right-0 animate-bounce" />
                          <p className="text-[10px] font-bold text-white bg-surface-2 border border-hairline px-3 py-1 rounded-lg">Uploading... {progress}%</p>
                        </div>
                      )}
                      {ocrStep === "ocr" && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                          <div className="h-full w-0.5 bg-fuel-amber absolute top-0 bottom-0 left-1/2 animate-ping" />
                          <p className="text-[10px] font-bold text-white bg-surface-2 border border-hairline px-3 py-1 rounded-lg">AI Extraction...</p>
                        </div>
                      )}
                      {ocrStep === "matching" && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                          <p className="text-[10px] font-bold text-white bg-surface-2 border border-hairline px-3 py-1 rounded-lg">Matching Customer Ledger...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={startSimulation}
                disabled={ocrStep !== "idle" && ocrStep !== "done"}
                className="shine mt-4 w-full flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber text-canvas text-xs font-bold disabled:opacity-50 transition shadow-md shadow-fuel-amber/20 cursor-pointer"
              >
                <Sparkles size={14} />
                {ocrStep === "idle" ? "Simulate OCR Ingestion" : ocrStep === "done" ? "Restart Simulation" : "Processing Ledger..."}
              </button>
            </div>

            {/* Right side: Pipeline Results */}
            <div className="lg:col-span-7 rounded-xl border border-hairline bg-surface-1 p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle mb-3">Pipeline Execution Log</p>
                
                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                    ocrStep !== "idle" ? "border-hairline bg-canvas" : "border-transparent opacity-40"
                  }`}>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      ocrStep === "uploading" ? "bg-fuel-amber text-canvas animate-pulse" : 
                      ocrStep !== "idle" ? "bg-success text-canvas" : "bg-surface-3 text-ink-subtle"
                    }`}>
                      {ocrStep !== "idle" && ocrStep !== "uploading" ? <Check size={12} /> : "1"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">Document Validation</p>
                      <p className="text-[10px] text-ink-subtle mt-0.5">Checked integrity, resolution size, and image orientation.</p>
                      {ocrStep === "uploading" && (
                        <div className="mt-2 h-1.5 w-32 bg-surface-3 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fuel-amber to-fuel-orange rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                    ocrStep === "ocr" || ocrStep === "matching" || ocrStep === "done" ? "border-hairline bg-canvas" : "border-transparent opacity-40"
                  }`}>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      ocrStep === "ocr" ? "bg-fuel-amber text-canvas animate-pulse" : 
                      ocrStep === "matching" || ocrStep === "done" ? "bg-success text-canvas" : "bg-surface-3 text-ink-subtle"
                    }`}>
                      {ocrStep === "matching" || ocrStep === "done" ? <Check size={12} /> : "2"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink">Gemini OCR Parsing</p>
                        {(ocrStep === "matching" || ocrStep === "done") && (
                          <span className="badge-success text-[8px] font-mono px-2 py-0.5 rounded-full font-bold">98% Confidence</span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-subtle mt-0.5">Parsed text block: "DL-1GC-4530", "DIESEL", "120.00 Ltrs".</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                    ocrStep === "matching" || ocrStep === "done" ? "border-hairline bg-canvas" : "border-transparent opacity-40"
                  }`}>
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      ocrStep === "matching" ? "bg-fuel-amber text-canvas animate-pulse" : 
                      ocrStep === "done" ? "bg-success text-canvas" : "bg-surface-3 text-ink-subtle"
                    }`}>
                      {ocrStep === "done" ? <Check size={12} /> : "3"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-ink">Customer Ledger Reconciliation</p>
                        {ocrStep === "done" && (
                          <span className="badge-warning text-[8px] font-mono px-2 py-0.5 rounded-full font-bold">Auto-Matched</span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-subtle mt-0.5">Found match: "R.K. Transport Corp" (UUID: cc8a-2391-aa02).</p>
                    </div>
                  </div>
                </div>
              </div>

              {ocrStep === "done" && (
                <div className="mt-4 border border-success/30 bg-success-muted rounded-lg p-3.5 flex items-center justify-between animate-fade-in-up">
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-success shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-success">Voucher Entry Generated</p>
                      <p className="text-[10px] text-success/70">Account statement updated with DL-1GC-4530 credit purchase of Rs. 11,100.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/login")}
                    className="flex items-center text-xs font-bold text-ink hover:text-fuel-amber cursor-pointer transition"
                  >
                    View in App
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Tally XML block ── */}
      <section className="bg-canvas border-t border-hairline py-20 z-10 relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fuel-amber mb-2">Tally Sync API Integration</p>
          <h2 className="text-3xl font-bold tracking-[-0.8px] text-ink">
            A secure bridge to financial accounting.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs text-ink-muted leading-relaxed">
            Export reconciled daily shifts, cash receipts, and customer ledger bills straight into Tally Prime via XML export. No typing errors, zero duplicate invoices, absolute compliance.
          </p>

          <div className="mt-10 rounded-xl border border-hairline bg-surface-1 p-4 max-w-2xl mx-auto text-left font-mono text-[10px] text-ink-muted shadow-xl">
            <div className="flex items-center gap-1.5 border-b border-hairline pb-2.5 mb-3 text-[10px] text-ink-subtle">
              <span className="h-2.5 w-2.5 rounded-full bg-error/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-fuel-amber/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-2 font-mono">tally-sync-payload.xml</span>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-ink-subtle">
{`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES><SVCURRENTCOMPANY>JAI DURGE FUELS</SVCURRENTCOMPANY></STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <DATE>20260713</DATE>
            <VOUCHERNUMBER>PL-9028</VOUCHERNUMBER>
            <PARTYLEDGERNAME>R.K. Transport Corp.</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Diesel Sales A/c</LEDGERNAME>
              <AMOUNT>-11100.00</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-20 z-10 relative">
        <div className="text-center mb-16">
          <p className="font-mono text-[10px] uppercase tracking-widest text-fuel-amber mb-2">Pricing Tiers</p>
          <h2 className="text-3xl font-bold tracking-[-0.8px] text-ink">
            Transparent plans for single or multi-pump layouts.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch stagger-children">
          {/* Starter */}
          <div className="rounded-xl border border-hairline bg-surface-1 p-6 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Starter</p>
              <p className="text-2xl font-bold tracking-tight text-ink mt-2">Free</p>
              <p className="text-[10px] text-ink-subtle mt-0.5">For single pump onboarding</p>
              
              <ul className="mt-6 space-y-3.5 text-xs text-ink-muted border-t border-hairline pt-5">
                {["Up to 100 invoice scans / month", "Customer Ledger accounts", "Basic PDF exports"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check size={13} className="text-success shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link to="/login" className="mt-6 block text-center rounded-lg border border-hairline bg-surface-2 py-2.5 text-xs font-bold text-ink hover:bg-surface-3 transition">
              Get Started
            </Link>
          </div>

          {/* Pro */}
          <div className="gradient-border shadow-xl shadow-fuel-amber/5">
            <div className="rounded-xl bg-surface-1 p-6 flex flex-col justify-between relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-fuel-amber to-fuel-orange px-3.5 py-1 text-[9px] font-mono tracking-wider uppercase text-canvas font-bold shadow-md">
                Most Popular
              </span>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-fuel-amber mt-1">Professional</p>
                <p className="text-2xl font-bold tracking-tight text-ink mt-2">₹1,999<span className="text-xs font-normal text-ink-subtle"> / mo</span></p>
                <p className="text-[10px] text-ink-subtle mt-0.5">For active petrol stations</p>

                <ul className="mt-6 space-y-3.5 text-xs text-ink-muted border-t border-hairline pt-5">
                  {["Unlimited OCR invoice uploads", "Automatic customer credit locks", "One-click Tally integration XML", "Analytics reporting and metrics"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check size={13} className="text-fuel-amber shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/login" className="shine mt-6 block text-center rounded-lg bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber text-canvas py-2.5 text-xs font-bold transition shadow-md shadow-fuel-amber/20 cursor-pointer">
                Start Free Trial
              </Link>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-xl border border-hairline bg-surface-1 p-6 flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Enterprise</p>
              <p className="text-2xl font-bold tracking-tight text-ink mt-2">Custom</p>
              <p className="text-[10px] text-ink-subtle mt-0.5">For petrol pump dealership groups</p>

              <ul className="mt-6 space-y-3.5 text-xs text-ink-muted border-t border-hairline pt-5">
                {["Multi-pump network consolidation", "Dedicated custom OCR models", "Priority API & custom exports", "SLA uptime and dedicated support"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check size={13} className="text-success shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Link to="/login" className="mt-6 block text-center rounded-lg border border-hairline bg-surface-2 py-2.5 text-xs font-bold text-ink hover:bg-surface-3 transition">
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-hairline bg-canvas py-16 z-10 relative">
        <div className="mx-auto max-w-5xl px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "OCR Engine", href: "#demo" }, { label: "Pricing", href: "#pricing" }] },
            { title: "Integration", links: [{ label: "Tally Prime XML", href: "#" }, { label: "Custom Ledger Export", href: "#" }, { label: "REST API Reference", href: "#" }] },
            { title: "Company", links: [{ label: "About", href: "#" }, { label: "Contact Support", href: "#" }, { label: "System Status", href: "#" }] },
            { title: "Security", links: [{ label: "Privacy Policy", href: "#" }, { label: "Terms of Service", href: "#" }, { label: "Compliance", href: "#" }] },
          ].map((col) => (
            <div key={col.title}>
              <p className="text-[10px] font-mono uppercase tracking-wider text-ink font-semibold mb-4">{col.title}</p>
              <ul className="space-y-2.5 text-xs text-ink-subtle">
                {col.links.map((l) => (
                  <li key={l.label}><a href={l.href} className="hover:text-ink transition">{l.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-5xl px-6 mt-12 pt-8 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-ink-subtle text-[11px]">
            <Fuel size={14} className="text-fuel-amber" />
            <span>© 2026 PumpLedger AI Inc. All rights reserved.</span>
          </div>
          <span className="text-[9px] font-mono text-ink-tertiary">v1.0 · Fuel Dark</span>
        </div>
      </footer>
    </div>
  );
}
