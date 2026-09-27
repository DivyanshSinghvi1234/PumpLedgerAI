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

1. **Authentication & Role-Based Access Control (RBAC):** JWT session auth with granular permission tiers (`ADMIN`, `MANAGER`, `OPERATOR`).
2. **AI-Powered OCR Pipeline:** Vision model (Google Gemini / OpenRouter / Ollama) extraction from fuel slips/invoices with confidence scoring and a human-in-the-loop review interface.
3. **Vouchers & Ledger Automation:** Live synchronization between vouchers and credit accounts, supporting search, filtering, and pagination.
4. **Customer Credit & Debtor Aging:** Comprehensive customer ledgers, automated FIFO payment allocation, live balance calculations, and one-click WhatsApp statement digests.
5. **Vehicle Fleet Management:** Dedicated vehicle registry and vehicle-scoped fuel consumption ledgers.
6. **Fuel Inventory & Dispensers:** Tank dip logs, dispenser/nozzle meter readings, and meter rollover handling.
7. **Cash Sheet & Bank Reconciliation:** Shift management, cash drawer balancing, bank account management, and income/expense tracking.
8. **Audit Trail & Reports:** Detailed action logging, financial statement generation, and Tally-compatible XML exports.

## Testing & Quality Assurance

- **Backend:** 58 automated unit and integration tests (`pytest` / `uv run pytest`).
- **Frontend:** Strict TypeScript type-checking (`tsc -b`) and optimized production bundling with Vite.

