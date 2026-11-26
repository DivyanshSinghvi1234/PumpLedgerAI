# PumpLedgerAI

AI-powered petrol-pump invoice automation. Upload an invoice image, an AI
vision model (Google Gemini) extracts the fields, you review/correct them, and
save the result as a voucher (accounting entry).

## Tech stack

- **Backend:** FastAPI, SQLAlchemy, Pydantic v2, SQLite (dev), JWT auth
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **AI/OCR:** Google Gemini (configurable to OpenRouter / Ollama)

## Prerequisites

- Python 3.13+
- Node.js 18+
- A Google Gemini API key (for OCR). Manual voucher entry works without it.

## Backend — run

```bash
cd backend

# 1. Configure environment
#    Edit .env and set GOOGLE_API_KEY=<your key>
#    (AI_PROVIDER defaults to "gemini")

# 2. Install dependencies (uv or pip)
uv sync            # or: pip install -e .

# 3. Start the API (creates the SQLite DB + seeds the admin user on first run)
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- API root: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs

The database and a default admin user are created automatically on startup.
To (re)seed the admin manually: `python ../scripts/create_admin.py`

### Default login

| Username | Password   |
| -------- | ---------- |
| `admin`  | `admin123` |

Change these via `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` in config
before first run, or update the user later.

## Frontend — run

```bash
cd frontend

npm install
npm run dev
```

Open http://localhost:5173, sign in with the default admin credentials.

The frontend expects the backend at `http://127.0.0.1:8000` (see
`src/api/client.ts`). CORS for `localhost:5173` is enabled on the backend.

## Key Features & Completed Modules

1. **Authentication, RBAC & PIN Quick-Switch:** JWT session auth with granular permission tiers (`ADMIN`, `MANAGER`, `OPERATOR`), role-based home redirect, and a 4-digit PIN quick-switch lock screen.
2. **AI-Powered OCR & OMC Tanker Auto-Pilot:** Vision model (Google Gemini / OpenRouter / Ollama) extraction for fuel slips and IOCL/BPCL/HPCL tanker invoices—matching open Purchase Indents, updating tank stock & `avg_cost_per_liter`, debiting banks, and flagging short-delivery variance.
3. **Single-Source Daily Pipeline & 5-Point Auto-Audit:** Unified calculation engine connecting Meter Readings, Vouchers, Payments, Expenses, 8 PM Shift Settlement, Daily Register, and Day Closing—with a live 5-Point Auto-Audit banner, 1-click Auto-Balance Unbilled Cash, 4-Checkpoint Pre-Lock Safety Gate, and Books Health Check.
4. **Idempotent Bank & Cash Ledger:** Deterministic reference keys (`VCH-`, `PAY-`, `DEL-`, `IND-`, `INC-`), two-way Daily Register ↔ Day Closing sync, printable Bank Deposit Slips, passbook running balances, and a live Cash & Bank Flow Timeline.
5. **Customer Credit, Risk Scoring & Duplicate Merge:** Comprehensive customer ledgers, selective invoice payment, 1-click full-due & round-off settlement, Red/Amber/Green risk scoring, Day 15/30 WhatsApp reminders, and 1-click duplicate customer merge.
6. **Fuel Inventory, 6 AM Price Split & Margin Analytics:** Tank dip logs, animated liquid tank gauges, nozzle meter readings with yesterday's closing/7-day average sanity guards, 6 AM price-change stock gain/loss alerts, and tank-wise profit cards.
7. **Forecourt Quick Entry & Offline Mode:** Offline slip queue with auto-sync, Exact Amount vs. Round Liters toggle, large numeric keypad, vehicle plate auto-formatter, `Cmd+Enter` speed mode, and 8-second Undo toast.
8. **Multilingual & Modern App Experience (Design System 2.0):** `EN / हिं / Hinglish` language switcher, customizable **Executive Bento Cockpit** with SVG collection mix & live tank telemetry, interactive **2D Forecourt & Tank Twin** (`/dashboard/forecourt-twin`), **5-Step Guided Close-the-Day Wizard** (`/dashboard/close-day`), **Touch-First Forecourt POS Kiosk** (`/dashboard/pos`), unified **CSV Export** & table skeletons, interactive per-page Guide/Tutorial drawer, `Cmd+K` Spotlight Command Palette, mini icon-rail sidebar with pinned favorites, mobile bottom dock with `+` Quick Slip FAB, Sunlight High-Contrast & Easy-Read modes, and Cashflow Waterfall What-If Simulator.
9. **Audit Trail, Tally Sync & Reports:** Detailed action logging, Pre-Export Data Integrity Audit, financial statements, and Tally-compatible XML exports.

## Testing & Quality Assurance

- **Backend:** 93 automated unit and integration tests (`cd backend && .venv/bin/pytest`).
- **Frontend:** Strict TypeScript type-checking (`tsc -b`), PWA production bundling with Vite (`cd frontend && npm run build`), unit tests (`cd frontend && npm test`), and Playwright E2E smoke suite (`cd frontend && npm run test:e2e`).

