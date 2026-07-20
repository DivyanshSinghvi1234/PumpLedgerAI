# CLAUDE.md

Guidance for working in the PumpLedgerAI codebase.

## Mandatory Project Rules
- **Read AGENTS.md:** Always follow the rules in `AGENTS.md`.
- **Knowledge Graph & Obsidian:** 
  - For codebase & architecture questions, first run `graphify query "<question>"` when `graphify-out/graph.json` exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts.
  - If `graphify-out/wiki/index.md` or `graphify-out/obsidian/` exists, use it for broad navigation instead of raw source browsing.
  - Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review.
  - After modifying code, run `graphify update .` to keep the graph current.

## What this is

AI-powered petrol-pump invoice automation. Core loop: **upload invoice image →
Google Gemini vision extracts fields → user reviews/corrects → save as a voucher
(accounting entry)**. Plus customers, vehicles, dashboard, reports, and
role-based user management.

## Tech stack

- **Backend:** FastAPI, SQLAlchemy 2.x (typed `Mapped[...]`), Pydantic v2,
  SQLite (dev) / PostgreSQL (prod), JWT auth (`python-jose`), `bcrypt` for
  password hashing. Package manager: `uv` (see `backend/pyproject.toml`,
  `uv.lock`). Python 3.13.
- **Frontend:** React + TypeScript + Vite, Tailwind CSS, shadcn/ui, TanStack
  Query, react-hook-form + zod, axios, sonner (toasts), react-router-dom.
- **AI/OCR:** Google Gemini (`google-genai`). Provider is pluggable
  (gemini/openrouter/ollama) via `AI_PROVIDER` env var.

## Run commands (run the site locally)

Deps live in the backend's `.venv` managed by **`uv`** — NOT in the base/Anaconda
Python. Launch the backend with `uv run`. A bare `uvicorn app.main:app` resolves
to Anaconda's interpreter, which has no FastAPI installed and dies with
`ModuleNotFoundError: No module named 'fastapi'`.

Open two terminals from the repo root:

```bash
# ── Terminal 1: Backend — MUST run on port 8000 (frontend hardcodes it in src/api/client.ts) ──
cd backend
uv sync                                                    # first time only — install deps into .venv
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# → API at  http://127.0.0.1:8000     Docs at  http://127.0.0.1:8000/docs

# ── Terminal 2: Frontend ──
cd frontend
npm install                                                # first time only
npm run dev          # → http://localhost:5173
npm run build        # tsc -b && vite build — use this to typecheck
```

Then open **http://localhost:5173** and log in with **admin / admin123**
(auto-seeded on first startup by `seed_admin()` in `app/database/init_db.py`).

How local wiring works: Vite dev server proxies `/api` and `/storage` to
`127.0.0.1:8000` (see `frontend/vite.config.ts`), so both origins reach the
backend with no CORS setup. In production that proxy is replaced by nginx —
see `frontend/nginx.conf` (which now proxies BOTH `/api` and `/storage`).

Sanity checks (both should print `200`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/    # backend
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/    # frontend
# import the app without serving:
cd backend && uv run python -c "import app.main; print('OK')"
```

Requires `GOOGLE_API_KEY` in `backend/.env` for OCR; everything else works
without it.

## Architecture & conventions

**Backend layering (keep routes thin):**
`routes/ (HTTP) → services/ (business logic) → repositories/ (DB access)`.
Pydantic `schemas/` for I/O validation. Business logic must NOT live in routes;
DB queries must NOT live in services.

- **Auth:** router-level `Depends(get_current_user)` in `app/main.py` protects
  whole routers (voucher, upload, vision, customer, vehicle, dashboard, user).
  Per-route `Depends(require_roles(...))` (from `app/core/dependencies.py`) adds
  role gates on specific mutating endpoints. `auth` is public.
- **Role matrix:** ADMIN = everything incl. user management; MANAGER = manage
  vouchers/customers/vehicles + verify/reject/delete + reports; OPERATOR =
  create/edit vouchers + upload + view only. Enforced via `require_roles`.
- **Enums** live in `app/core/enums.py`. `FuelType` = PETROL / SPEED / DIESEL /
  LUBRICANT. `UserRole` = ADMIN / MANAGER / OPERATOR.
- **Exceptions:** domain errors in `app/core/exceptions.py` (subclass
  `AppException`); routes catch them and map to `HTTPException`.
- **DB init:** `init_db()` runs `Base.metadata.create_all` + `seed_admin()` +
  `seed_pumps()` on startup. There is **no migration step wired into dev** — see
  gotcha below.
- **Multi-tenant pump scoping:** the app is scoped per filling station. Models
  that inherit `PumpScopedMixin` (`app/database/mixins.py`) carry a `pump_id`.
  `PumpScopingMiddleware` reads the `X-Pump-UUID` request header and, via
  `app/database/scoping.py` (a `do_orm_execute` event listener), auto-filters
  every SELECT to the active pump and auto-populates `pump_id` on insert. The
  frontend sends `X-Pump-UUID` from `localStorage` (`active_pump_uuid`, set by
  `authService`/`PumpSwitcher`). If pump-scoped data "disappears," check the
  active pump header, not the query.
- **File uploads go through `StorageService`** (`app/services/storage_service.py`):
  Backblaze B2 / R2 in prod, local-disk fallback in dev. Always upload via
  `storage_service.upload(fileobj, filename, content_type)` — it returns an
  absolute `https://` URL when object storage is configured, or a local
  `storage/...` path otherwise. Never write uploads straight to disk (see
  ephemeral-storage gotcha).

**Frontend structure:**
- `src/features/<feature>/` is the unit: `{components, hooks, services, types}`
  + a `*Page.tsx`. **`features/customers/` is the reference implementation** for
  full CRUD (list + create/edit dialog + delete confirm + hooks) — mirror it when
  building new features (vouchers, vehicles, users).
- `src/api/client.ts` — axios instance, base URL `http://127.0.0.1:8000/api`.
  Attaches the bearer token; on 401 clears token and redirects to `/login`.
- Shared UI: `src/components/ui/` (shadcn), `src/components/common/`,
  `src/components/forms/` (FormInput/FormSelect/FormTextarea/FormActions).
- Auth state: `features/auth/services/authService.ts` stores token + current user
  (incl. role) in localStorage; use `hasRole(...)` / `useCurrentUser()` to gate UI.
- Route guard: `layouts/AppLayout.tsx` redirects to `/login` if no token.

## Gotchas discovered (don't re-trip these)

- **Frontend expects backend on port 8000.** If login says "Invalid username or
  password" but credentials are right, the backend is almost certainly not
  running — that error is shown for network failures too.
- **API path shape:** frontend services call `/v1/...` on a base of `/api`
  (→ `/api/v1/...`). Backend upload route is `/uploads` (plural).
- **`passlib` is NOT used** — it's incompatible with bcrypt 5.x. Password hashing
  uses the `bcrypt` library directly in `app/core/security.py` (72-byte cap
  handled explicitly). Don't reintroduce `passlib`.
- **`create_all` never ALTERs existing tables.** Adding a column to a model
  won't update an existing `pumpledger.db`. In dev, delete/rename the DB file to
  rebuild (it re-seeds admin), OR run `python -m alembic upgrade head`.
- **Schema evolution is a hybrid — read this before adding columns/migrations.**
  Prod (Neon Postgres) was originally built by `create_all`, so it has NO
  `alembic_version` row, and `create_all` can't add new columns to existing
  tables. Two things keep prod in sync: (1) `check_and_update_schema()` in
  `init_db.py` does idempotent `ADD COLUMN` backfills at app startup — add
  prod-critical columns here too; (2) on deploy, `bash prestart.sh` stamps an
  un-versioned DB at the merge head then runs `alembic upgrade head`. **All
  Alembic migrations MUST be idempotent** — use `backend/alembic_helpers/
  idempotent.py` (`add_column_if_missing`, etc.), never bare `op.add_column`,
  because the column may already exist from the backfill. Keep a single Alembic
  head (merge branches with `alembic merge`).
- **OCR result is intentionally tolerant.** `schemas/vision.py::OCRResult` has
  optional/defaulted fields so a partial extraction still reaches the review
  screen for correction. Don't make these strictly required.
- **Two `OCRParser`-style layers existed;** the live one is
  `app/services/ocr_parser.py` (the `app/utils/` duplicates were removed).
- **Hosted disk is ephemeral (Render).** Anything written to `storage/`
  disappears on redeploy/restart. Uploads that skip `StorageService` show broken
  images on the live site but work locally. When rendering a stored image
  reference, resolve it with a helper that passes absolute `https://` URLs
  verbatim and roots bare/local paths under `/storage` (see `invoiceImageUrl`
  and `dailySheetService.resolveImageUrl`) — never blindly prepend `/storage/`.
- **Native `<input type="date">` renders in the browser locale, not page code.**
  `index.html` sets `<html lang="en-IN">` to force dd/mm/yyyy — don't revert to
  plain `en`. Formatted (non-input) dates use explicit
  `toLocaleDateString("en-IN"/"en-GB")`; keep passing an explicit locale.
- **Distinguish query error from empty result in list/form UIs.** A failed
  request that's rendered the same as an empty response hides the real error
  (this masked a meter-readings failure as "No nozzles configured"). Read
  `isError` from TanStack Query and show a distinct error state.

## Status / roadmap

**➡️ Live plan + progress tracker: `docs/MVP_PLAN.md` — read it first every session.**
It has the current phase status, per-task checkboxes, and the recommended build
order. Update its checkboxes as work completes.

Being built in phases (the old `.claude/plans/lucky-brewing-dream.md` is gone;
`docs/MVP_PLAN.md` supersedes it): completing the
core product — real dashboard w/ charts, full voucher CRUD UI, vehicles UI,
reports + CSV export, user-management UI, all role-gated. **Deferred until the
core is solid:** Tally export, audit log, RAG AI-chat. (dashboard is the exception; it's built out under `app/modules/dashboard`).

## House rules

- Production-ready, typed, modular. Small functions. Reuse existing patterns
  before adding new ones; don't duplicate. Match surrounding style.
- **OCR/vision: never guess extracted values; preserve numbers exactly.**
- Don't delete existing functionality unless asked. Ask before breaking
  architectural changes.
