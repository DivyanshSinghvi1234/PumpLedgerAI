# CLAUDE.md

Guidance for working in the PumpLedgerAI codebase.

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

## Run commands

```bash
# Backend — MUST run on port 8000 (frontend hardcodes it in src/api/client.ts)
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# Docs at http://127.0.0.1:8000/docs

# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build — use this to typecheck

# Quick backend sanity check (import the app without serving)
cd backend && python -c "import app.main; print('OK')"
```

Default login: **admin / admin123** (auto-seeded on first startup by
`seed_admin()` in `app/database/init_db.py`). Requires `GOOGLE_API_KEY` in
`backend/.env` for OCR; everything else works without it.

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
- **Enums** live in `app/core/enums.py`. `FuelType` = PETROL / DIESEL /
  LUBRICANT. `UserRole` = ADMIN / MANAGER / OPERATOR.
- **Exceptions:** domain errors in `app/core/exceptions.py` (subclass
  `AppException`); routes catch them and map to `HTTPException`.
- **DB init:** `init_db()` runs `Base.metadata.create_all` + `seed_admin()` on
  startup. There is **no migration step wired into dev** — see gotcha below.

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
- **SQLite schema is create-only.** `create_all` never ALTERs existing tables, so
  adding a column to a model won't update `pumpledger.db`. In dev, delete/rename
  the DB file to rebuild (it re-seeds admin). Alembic migrations exist under
  `backend/alembic/` but aren't auto-run.
- **OCR result is intentionally tolerant.** `schemas/vision.py::OCRResult` has
  optional/defaulted fields so a partial extraction still reaches the review
  screen for correction. Don't make these strictly required.
- **Two `OCRParser`-style layers existed;** the live one is
  `app/services/ocr_parser.py` (the `app/utils/` duplicates were removed).

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
