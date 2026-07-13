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

## Core flow

1. **Login** → obtains a JWT (stored in `localStorage`, sent as a Bearer token).
2. **Upload Invoice** → image is sent to the backend, Gemini extracts fields.
3. **Review** → correct any fields (fuel type / payment mode are dropdowns);
   validation warnings/errors are shown.
4. **Save Voucher** → persisted; appears in **Vouchers** (search/filter/paginate).
5. **Customers** → full CRUD.

## Notes / roadmap

This is the first working version. The following module folders are scaffolded
for future updates and are intentionally empty for now: `analytics`, `audit`,
`rag`, `reports`, `tally`. Vehicles has backend support but no dedicated UI yet.
