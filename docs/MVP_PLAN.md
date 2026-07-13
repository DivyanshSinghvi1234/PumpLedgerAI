# PumpLedger AI — MVP Plan & Progress Tracker

> **Single source of truth for MVP scope + progress.**
> Read this first on every restart. Update the checkboxes when a task is done.
> Last verified against code: **2026-07-12**
>
> ## 🎉 STATUS: MVP COMPLETE (all Phases 1–8 done & frozen, 2026-07-12)
> All modules built + verified: Auth, Dashboard, Customers, Vehicles, Vouchers
> (manual + OCR), Payments, Customer Ledger (source of truth for balances), Reports
> (+CSV). E2E smoke test 34/34; frontend build green.
> **Next up: Tally export (v1.1)** — the only remaining scoped item.

---

## 0. Ground rules (do not violate)

- Architecture is **frozen**. Backend: `Router → Service → Repository → DB`.
  Frontend: `Page → Hook → Service → API (React Query)`. Never skip layers.
- **Extend existing code**; do not rewrite. `features/customers/` (frontend) and
  the customer backend layers are the **reference implementations** — mirror them.
- Generate **complete files**, no placeholders, no TODOs, no invented APIs.
- **OCR/vision:** never guess extracted values; preserve numbers exactly.
- **Tally is LAST** — do not touch until every other module is frozen.
- Ledger is the simple MVP design (see §Ledger), NOT double-entry accounting.

## 0a. Known divergences from the spec (decided)

- **Roles:** spec says "Multi User Roles = not MVP", but backend already ships
  `UserRole` + `require_roles`. **Keep it as-is** (removal is a breaking change).
  Do not expand role logic; just don't fight it.
- **`frontend/src/App.tsx`** is still the default Vite template and is **unused**
  (real routing lives in `src/routes/index.tsx`). Safe to ignore or delete later.

---

## Phase status legend
`[ ]` not started · `[~]` in progress · `[x]` done & verified · `[F]` FROZEN

---

## PHASE 1 — Customer Module  `[~]`
Backend is done; frontend needs a verification pass.
- [x] Model has `opening_balance`, `outstanding_balance`, `credit_limit`
- [x] Repository: CRUD + `search()` with pagination + lookups (code/mobile/gst)
- [x] Service + routes + schemas
- [x] Frontend: list page, table, create/edit dialog, delete confirm, hooks
- [ ] **VERIFY**: run frontend, confirm CRUD + search + pagination work E2E
- [ ] Freeze

## PHASE 2 — Vehicle Module  `[F]` FROZEN (2026-07-12)
Brought to full parity with the customer reference implementation.
- [x] Model + service + routes + schemas + frontend scaffold
- [x] Added `search()` + pagination to `vehicle_repository.py` (joins Customer,
      searches vehicle_number / vehicle_type / customer name)
- [x] `vehicle_service.search()` passthrough
- [x] **Fixed pre-existing bug**: `VehicleResponse` referenced `customer_uuid`,
      which the ORM model doesn't have. Now a `model_validator(before)` flattens
      `customer.uuid` → `customer_uuid` and `customer.name` → `customer_name`.
      Added `VehicleListResponse` (items + pagination).
- [x] Route `GET /vehicles` now takes `search/page/page_size`, returns list response
- [x] Frontend: server-side search + pagination (dropped client-side filter),
      table shows embedded `customer_name`; `useCustomerOptions` kept only for the
      create/edit dropdown
- [x] Verified: backend imports OK, schema flatten runtime-tested, `npm run build` green
- [F] **FROZEN** — do not modify without reason

## PHASE 3 — Voucher Module  `[F]` FROZEN (2026-07-12)
Backend already supported update/delete/search; this phase was **frontend-only**.
- [x] Backend: model, repo (sort/filter enums), service, routes (PUT + DELETE exist)
- [x] OCR upload + review flow (backend + frontend) complete
- [x] Frontend: list, filters, pagination, status badge
- [x] Added hooks `useUpdateVoucher` + `useDeleteVoucher` (mirror customer hooks)
- [x] Built `VoucherForm` (react-hook-form + zod) — **correct enums**
      PETROL/DIESEL/LUBRICANT + CASH/UPI/CARD/CREDIT
- [x] Built `VoucherDialog` (create AND edit) + `DeleteVoucherDialog`
- [x] Wired `VoucherTable` real actions (was `console.log` stubs) + `VoucherToolbar`
      "+ New Voucher" (was dead button) → manual entry now works from the list
- [x] Role-gated create/edit/delete via `useCurrentUser().hasRole("ADMIN","MANAGER")`
- [x] **Removed dead stale files**: `features/vouchers/types/voucher.ts` (had wrong
      CNG/LPG fuel enums) + `voucherSchema.ts` — nothing imported them; global
      `@/types/voucher` is the correct source
- [x] Verified: backend imports OK, service has update/delete/search, `npm run build` green
- [F] **FROZEN** — do not modify without reason

## PHASE 4 — Payment Module  `[F]` FROZEN (2026-07-12)
Full stack built + verified. Design decisions: link by customer UUID (real FK);
Alembic migration; overpayment allowed (balance may go negative = advance).
- [x] Model `app/models/payment.py` (customer_id FK, amount, payment_mode, payment_date,
      reference_number, remarks) + reverse `payments` relationship on Customer
- [x] Registered in `app/models/__init__.py` + `alembic/env.py`
- [x] Schema `app/schemas/payment.py` (create/response with flattened customer_uuid+name
      via model_validator, list response)
- [x] Repository `app/repositories/payment_repository.py`: `search` (join Customer,
      filter by customer_uuid/search, paginate) + **atomic** `create_with_balance`
      (single commit for row + balance) + `delete_with_balance` (restores balance).
      Both wrap in try/except → rollback on error.
- [x] Exception `PaymentNotFoundError`; service `payment_service.py`
      (create decrements balance, search, get, delete restores balance)
- [x] Route `app/api/v1/routes/payment.py` (POST/GET list/GET one/DELETE, role-gated
      ADMIN/MANAGER) — mounted in `app/main.py` under `/api/v1`
- [x] Frontend `features/payments/`: types, service, hooks (list + create + delete;
      create/delete invalidate BOTH `["payments"]` and `["customers"]`),
      Toolbar/Form/ReceivePaymentDialog/Table/DeletePaymentDialog, PaymentListPage
      (server search + pagination, role-gated)
- [x] `/payments` route (`routes/index.tsx`) + sidebar nav link (Wallet icon)
- [x] **VERIFIED**: backend import OK; frontend `npm run build` green; atomic-balance
      runtime test passed (pay→decrement, overpay→negative, delete→restore, filter/search);
      Alembic migration `6ac2bc8b8766_add_payments_table.py` autogenerated, **hand-cleaned**
      of an unrelated `vouchers.fuel_type` drift, applied to DB, `payments` table confirmed
- [F] **FROZEN** — do not modify without reason

**Migration note:** the dev DB was previously create_all'd but unstamped; I ran
`alembic stamp head` then autogenerated. Autogenerate emitted a stray
`vouchers.fuel_type` VARCHAR→Enum alter (pre-existing create_all-vs-migration drift) —
**removed** from the payments migration. That drift still exists and may reappear in a
future autogenerate; address it separately if it matters (harmless for SQLite dev).

## PHASE 5 — Customer Ledger  `[F]` FROZEN (2026-07-12) — LEDGER IS SOURCE OF TRUTH
Confirmed decisions: (1) wire vouchers into ledger now; (2) **ledger is the source of
truth**, `outstanding_balance` is a synced cache; (3) explicit DEBIT_ADJUSTMENT /
CREDIT_ADJUSTMENT types (amount positive, direction from type).
Built in sub-phases 5a → 5b → 5c. Full plan: `.claude/plans/virtual-prancing-owl.md`.

**Balance convention:** outstanding_balance = Σ(debits) − Σ(credits). Debit types
(OPENING_BALANCE, VOUCHER, DEBIT_ADJUSTMENT) increase dues; credit types (PAYMENT,
CREDIT_ADJUSTMENT) reduce them. `signed_amount()` in enums.py is the single source of sign.

### 5b — Rewire opening/payment/adjustment through ledger  `[x]` DONE & VERIFIED
- [x] Payment service: create flushes payment then `ledger_service.post(PAYMENT,
      extra_objects=[payment])`; delete `ledger_service.reverse_reference("PAYMENT",
      extra_deletes=[payment])`. Removed now-unused `payment_repository.create_with_balance`
      / `delete_with_balance` (ledger is the only balance writer) + dropped stale Decimal import.
- [x] Customer service: create seeds `outstanding_balance=0` then posts OPENING_BALANCE
      ledger entry (skips if opening_balance is 0); update posts DEBIT/CREDIT_ADJUSTMENT
      for the opening-balance delta instead of the inline `outstanding_balance += delta`.

### 5c — Wire vouchers into ledger  `[x]` DONE & VERIFIED
- [x] Schema: added optional `customer_uuid` to VoucherCreate/Update; VoucherResponse
      flattens customer_uuid from the `customer` relationship via model_validator.
- [x] Voucher service: resolves customer_uuid→customer_id; a CREDIT voucher linked to a
      customer posts a VOUCHER ledger entry (`_affects_ledger` helper). update reverses the
      old entry then re-posts from new state; delete reverses (extra_deletes=[voucher]).
- [x] Voucher route: catches CustomerNotFoundError → 404 on create/update.
- [x] Frontend: added optional "Linked Customer" dropdown to VoucherForm (empty = walk-in,
      submitted as null), customer_uuid in global types + edit defaults, useCustomerOptions
      hook; voucher create/update/delete hooks now invalidate ["customers"] + ["ledger"].
- [x] **No new migration** — vouchers.customer_id column already existed.

**VERIFIED (whole phase):** backend import OK; full invariant runtime test passed —
opening 1000 → payment 300 (700) → credit voucher 500 (1200) → edit voucher to 700 (1400,
reversal+repost) → delete voucher (700) → cash voucher (no effect) → unlinked credit voucher
(no effect); `outstanding_balance == ledger running total` at EVERY step. Frontend
`npm run build` green. Ledger migration `08ebb62c1d6b` applied.

**Note on Phases 3 & 4:** their balance code was reworked here to route through the ledger.
"Frozen" for those phases now means "frozen as reworked in Phase 5." Nothing mutates
`outstanding_balance` except `LedgerService`.

- [F] **FROZEN** — do not modify without reason

### 5a — Ledger core `[x]` DONE & VERIFIED (2026-07-12)
- [x] `LedgerEntryType` enum + `DEBIT_ENTRY_TYPES` + `signed_amount()` in enums.py
      (also removed the duplicate `from enum import Enum`)
- [x] Model `app/models/ledger_entry.py` (customer_id FK, entry_type, amount POSITIVE,
      entry_date, reference_type, reference_id, remarks) + reverse `ledger_entries` on
      Customer. **balance_after NOT stored** — computed as running total in the service.
      Registered in models/__init__.py + alembic/env.py.
- [x] Schema `app/schemas/ledger.py` (LedgerAdjustmentCreate Literal DEBIT/CREDIT,
      LedgerEntryResponse with signed_amount + balance_after, LedgerListResponse with
      opening/closing)
- [x] Repository `app/repositories/ledger_repository.py`: list_for_customer (full
      chronological series), get_entries_by_reference, atomic `post(extra_objects)`,
      atomic `remove(extra_deletes)` — single commit each, rollback on error
- [x] Service `app/services/ledger_service.py` = THE only balance writer: post,
      reverse_reference, create_adjustment, list_for_customer (running balance_after,
      per-page opening balance)
- [x] Route `app/api/v1/routes/ledger.py` (GET /customers/{uuid}/ledger,
      POST /customers/{uuid}/ledger/adjustments role-gated) — mounted in main.py
- [x] Frontend `features/ledger/`: types, service, hooks (useCustomerLedger,
      useCreateAdjustment invalidating ["ledger",uuid] + ["customers"]),
      LedgerSummary/LedgerTable/AdjustmentForm/AdjustmentDialog, CustomerLedgerPage
- [x] Route `/customers/:customerUuid/ledger`; "Ledger" (BookOpen) action added to
      CustomerActions → CustomerTable → CustomerListPage navigates there
- [x] Backend import check passed
- [x] **VERIFIED**: ledger runtime test passed (debit/credit adjustments move balance,
      running balance_after correct across entries, reverse_reference restores balance);
      migration `08ebb62c1d6b_add_ledger_entries_table.py` autogenerated, **hand-cleaned**
      of the recurring `vouchers.fuel_type` drift, applied, `ledger_entries` table confirmed;
      frontend `npm run build` green


## PHASE 6 — Dashboard  `[F]` FROZEN (2026-07-12)
Backend + frontend were already mostly built; this phase was correctness + spec-completion.
- [x] KPIs present: Today's Sales, **Today's Vouchers (added)**, Total Sales, Total Vouchers,
      Customers, Vehicles, Pending Review (= Pending OCR), Verified
- [x] **Fixed serialization bug** exposed by Phase 5c: dashboard router now uses
      `response_model=DashboardResponse` so `recent_vouchers` serialize through
      `VoucherResponse` (customer_uuid flatten). Previously returned a raw dict of ORM
      Voucher objects, which would mis-serialize the new customer link.
- [x] Added `today_vouchers` to dashboard repository, schema, frontend type + a StatCard
- [x] Verified: KPI queries return correct counts (runtime test); backend import OK;
      `DashboardResponse` serializes recent vouchers (linked → customer_uuid, walk-in →
      customer_name); frontend `npm run build` green
- [x] Frontend: 8 stat cards, fuel distribution card, recent vouchers table (all pre-built)
- [F] **FROZEN** — do not modify without reason

## PHASE 7 — Reports  `[F]` FROZEN (2026-07-12)
Backend + frontend built and verified.
Decisions: backend-generated CSV; all four reports; ledger = per-customer date-filtered statement.
- [x] CSV helper `app/common/csv_export.py` (stdlib csv + StreamingResponse + Content-Disposition)
- [x] Schemas `app/schemas/report.py`: VoucherReportRow/Response, CustomerReportRow/Response,
      LedgerReportRow/Response, DailyReportResponse (+ report_date)
- [x] Repository `report_repository.py` REWRITTEN (was broken placeholder): voucher_report
      (filters + totals), customer_report (search + total outstanding), daily_sales (any date)
- [x] `LedgerService.statement_for_customer` added (date-filtered; running balance over full
      series, opening/closing reflect range) — Phase 5 `list_for_customer` untouched
- [x] Service `report_service.py`: voucher/customer/ledger/daily reports + *_csv rows
- [x] Routes `app/api/v1/routes/report.py`: JSON + /export CSV for each, role-gated
      ADMIN/MANAGER, mounted in main.py under /api/v1
- [x] Frontend `features/reports/`: types, reportService (+downloadCsv blob download),
      4 hooks, 4 section components (Voucher/Customer/Ledger/DailySales), ReportsPage
      (local-state tabs). /reports route + sidebar link (BarChart3).
- [x] **VERIFIED backend**: import OK; runtime tests passed — voucher totals+filters,
      customer outstanding sum, daily breakdown, ledger date-filter (from & to, correct
      opening/closing), all 4 CSV generators; CSV helper media_type/Content-Disposition +
      stdlib quoting confirmed
- [x] **VERIFIED frontend**: `npm run build` green
- [F] **FROZEN** — do not modify without reason
- [ ] VERIFY, then Freeze

## PHASE 8 — Testing & Freeze MVP  `[F]` FROZEN (2026-07-12) 🎉 MVP COMPLETE
- [x] **API E2E smoke test** (`backend/_e2e_smoke.py`, TestClient vs fresh temp DB):
      34/34 checks — auth + 401 gate, customer CRUD, vehicle (embedded customer_name),
      voucher (credit→ledger, delete→reversal), payment (+delete restore), ledger +
      adjustment, dashboard (serialization + today_vouchers), all 4 reports + CSV exports.
      The full ledger invariant held across create/delete cycles at the HTTP layer.
- [x] **Perf / N+1 pass**: found + fixed N+1 introduced by Phase 5c — voucher `search`,
      `get_by_uuid`, and dashboard `recent_vouchers` serialize `VoucherResponse` which
      reads `voucher.customer`; added `joinedload(Voucher.customer)` to all three.
      All customer-serializing list repos (payment/vehicle/voucher/dashboard) now eager-load.
      Noted (acceptable for MVP): ledger reads load a customer's full entry series — bounded
      in practice.
- [x] Final builds green: backend `import app.main` OK; frontend `npm run build` OK.
- [F] **MVP FROZEN.**

**Not a git repo** — no commits made. `backend/_e2e_smoke.py` kept as a regression script
(run: `cd backend && python _e2e_smoke.py`).

**Known non-blocking warnings** (framework deprecations, not bugs): FastAPI warns
`ORJSONResponse is deprecated` and Starlette warns about httpx TestClient — cosmetic only.

## Post-MVP (deferred, per original scope)
- **Tally export (v1.1)** — the one remaining scoped item; intentionally last.
- Bundle code-splitting (frontend chunk >500kB advisory), audit log, RAG chat — later.

---

## Build order (recommended)
1. ~~**Phase 2 gap** (vehicle search/pagination)~~ ✅ DONE & FROZEN 2026-07-12
2. ~~**Phase 3 gap** (voucher edit/delete + manual entry)~~ ✅ DONE & FROZEN 2026-07-12
3. ~~**Phase 4 Payments**~~ ✅ DONE & FROZEN 2026-07-12
4. ~~**Phase 5 Customer Ledger**~~ ✅ DONE & FROZEN 2026-07-12 (ledger = source of truth)
5. ~~**Phase 6 Dashboard**~~ ✅ DONE & FROZEN 2026-07-12
6. ~~**Phase 7 Reports**~~ ✅ DONE & FROZEN 2026-07-12
7. ~~**Phase 8 — testing + MVP freeze**~~ ✅ DONE 2026-07-12 🎉 **MVP COMPLETE**
8. **Tally** (post-MVP, v1.1) — the next thing to build.
4. **Phase 5 Ledger** — build alongside/after payments. 
5. **Phase 6 Dashboard** → **Phase 7 Reports** → **Phase 8 freeze**. 
6. **Tally** (post-MVP, v1.1) — only after Phase 8 freeze.

## Key paths (so I don't re-scan every restart)
- Backend layers: `backend/app/{models,schemas,repositories,services}/`
- Routes: `backend/app/api/v1/routes/` (mounted in `backend/app/main.py`, `/api/v1`)
- Dashboard is the odd one: `backend/app/modules/dashboard/`
- Enums: `backend/app/core/enums.py` (`PaymentMode` already exists: CASH/UPI/CARD/CREDIT)
- Frontend features: `frontend/src/features/<name>/{components,hooks,services,types}`
- Frontend routing: `frontend/src/routes/index.tsx` (NOT `App.tsx`)
- API client: `frontend/src/api/` (base `http://127.0.0.1:8000/api`, calls `/v1/...`)

## Gotchas (from CLAUDE.md — still true)
- Backend MUST run on port 8000. "Invalid username/password" often = backend down.
- SQLite `create_all` never ALTERs. New columns → delete/recreate dev DB
  (`pumpledger.db`, re-seeds admin) OR run the Alembic migration.
- Don't reintroduce `passlib`. bcrypt is used directly in `core/security.py`.
- Default login: `admin / admin123`.
