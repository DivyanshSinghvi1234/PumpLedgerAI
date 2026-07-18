# Vehicle accounts + live-computed balances — implementation plan

## Goal (from user)

1. On voucher save/edit, resolve the **vehicle number** the same way customer
   name is resolved: normalize it, match an existing vehicle, else create a new
   one — and every vehicle belongs to a customer (existing or new).
2. Vehicles cluster under a customer in the vehicle section.
3. Edits reflect retroactively: adding a vehicle number to an already-saved
   voucher makes it appear in that vehicle's ledger with no backfill.
4. A **vehicle ledger view** with outstanding + the voucher list that has that
   vehicle number, with the same status / adjustment / image icons as customer.
5. An adjustment made in the vehicle view shows in the customer view and vice
   versa — **one number, two filters**.
6. Payment gets an optional vehicle field: empty = customer-wide FIFO (current
   behaviour); filled = FIFO restricted to that vehicle's vouchers.
7. Production-ready, and **customer balance computed live** (user decision).

## Core architectural decision (user-approved)

Stop treating `customers.outstanding_balance` as the source of truth. Compute
both balances live from the same rows, so vehicle and customer views can never
drift:

- **Customer outstanding** = `SUM(voucher.balance_due for that customer)` plus
  the net of manual adjustment ledger entries (`DEBIT_ADJUSTMENT` −
  `CREDIT_ADJUSTMENT`) and `OPENING_BALANCE`.
- **Vehicle outstanding** = same expression filtered by `vehicle_id`.

`voucher.balance_due` (= `total_amount − amount_paid`, floored at 0) already
exists and is maintained per-voucher by the settle/FIFO flows, so this is a pure
read model. Requirement 3 (retroactive edit) then falls out for free.

Adjustments stay customer-level ledger entries (they have no single voucher to
attach to). To keep requirement 5 truthful, the **vehicle view surfaces the
customer's adjustments in a clearly-labelled "account-level" section** rather
than pretending they belong to one vehicle — a vehicle's *voucher* balance is
its own, and the customer-level adjustments/credits are shown as shared account
activity. This avoids inventing a second adjustment ledger that could drift.

## What already exists (no migration needed for the core link)

- `vehicles` table + `Vehicle.customer_id` (NOT NULL) + `Vehicle.vehicle_number`
  (unique) already exist.
- `vouchers.vehicle_id` FK column + `Voucher.vehicle` relationship already
  exist — **but nothing ever sets `vehicle_id`** today (only the free-text
  `vehicle_number` string is stored). Populating it is the key backend change
  and needs no schema change.

## Backend changes

### 1. Vehicle number normalization + resolve-or-create
- `app/common/` → add `normalize_vehicle_number(raw)` (uppercase, strip spaces/
  hyphens/dots). Single shared helper used by repo lookups and voucher linking.
- `VehicleRepository`: store a normalized form. Options — add a
  `normalized_number` column (needs DB rebuild, SQLite is create-only) **or**
  match by `func.replace/upper` on the fly. Plan: add `normalized_number`
  column + backfill on rebuild for correct uniqueness; provide
  `get_by_normalized(db, normalized)`.
- `VoucherService._link_or_create_vehicle(db, customer, vehicle_number)`
  mirroring `_link_or_create_customer`: normalize → match → else create a
  `Vehicle` under the resolved customer. Called from both `create` and
  `update`, setting `voucher.vehicle_id`. Because a vehicle needs a customer,
  vehicle linking runs **after** customer resolution and only when a customer
  was resolved/created.

### 2. Live balance read model
- New `BalanceService` (or methods on a repository) computing:
  - `customer_outstanding(db, customer_id)`
  - `vehicle_outstanding(db, customer_id, vehicle_id)`
  from `SUM(balance_due)` + adjustment/opening ledger entries.
- Repurpose the stored `customers.outstanding_balance`: keep the column but
  treat it as a **cache updated by the ledger writer** (kept for the dashboard
  aggregate query) OR switch all reads to the live value. Plan: switch the
  ~17 read sites (customer list, `CustomerOutstandingResponse`, notifications,
  report dashboard total, ledger `balance_after`) to the live value, and keep
  `LedgerService` writing the cache so nothing else breaks. This is the
  invasive part — every site listed in the plan's grep gets audited.

### 3. Vehicle ledger endpoints (mirror customer ledger)
- `GET /v1/vehicles/{uuid}/ledger` → outstanding + that vehicle's vouchers with
  status/mismatch/image fields (reuse `LedgerEntryResponse`-style shape).
- Extend `VehicleResponse` with a live `outstanding_balance`.
- `VehicleRepository.list_vouchers_for_vehicle(vehicle_id)`.

### 4. FIFO payment scoping by vehicle
- `VoucherRepository.list_for_customer_fifo(customer_id, vehicle_id=None)` —
  add the optional filter (one `if vehicle_id is not None` clause).
- `VoucherPaymentService.allocate_payment_fifo(..., vehicle_uuid=None)` resolves
  the vehicle (must belong to the customer) and passes `vehicle_id` through.
- `PaymentFifoAllocateRequest` gains optional `vehicle_uuid`; payment route
  passes it. Empty = current customer-wide behaviour.

### 5. Grouping vouchers under a customer by vehicle
- Customer detail / ledger: group the voucher list into "Vehicle A / Vehicle B /
  General (no vehicle)" buckets. Backend can expose `vehicle_number` +
  `vehicle_uuid` on the voucher rows it already returns (voucher already has the
  relationship) so the frontend groups client-side.

## Frontend changes

- **VehicleAutocomplete** component mirroring `CustomerAutocomplete` (normalize,
  suggest existing, link vs create) used in `VoucherForm` and `OCRReviewForm`,
  replacing the plain `vehicle_number` `FormInput`. Selecting a vehicle can also
  auto-fill its customer.
- **Vehicle ledger page** mirroring `CustomerLedgerPage` + `LedgerTable` +
  `LedgerSummary`, reached from a "View Ledger" icon in `VehicleTable`
  (mirroring `CustomerActions`). Route `vehicles/:vehicleUuid/ledger`.
- `VehicleTable`: add Outstanding column + status badge + View-Ledger action,
  mirroring `CustomerTable`.
- **Payment form**: optional VehicleAutocomplete; when set, send `vehicle_uuid`.
- Vehicle list: cluster/group by customer (grouped rows or customer column +
  sort).
- Types/services updated (`vehicle.ts`, `vehicleService.ts` add
  `getVehicleLedger`; `payment.ts` add optional `vehicle_uuid`).

## Testing / verification

- Backend: extend `backend/tests/` (there's already `test_fifo_payment.py`) with
  vehicle-scoped FIFO, resolve-or-create + normalization, and live-balance
  agreement (customer total == sum of its vehicles' voucher balances + account
  adjustments). Run with the project's pytest.
- `cd backend && python -c "import app.main"` import check.
- Frontend: `npm run build` (tsc typecheck).
- DB rebuild note: adding `normalized_number` to vehicles requires
  deleting/rebuilding `pumpledger.db` in dev (create-only), which re-seeds admin.
- Run `graphify update .` after code changes (project rule).

## Sequencing (incremental, each independently verifiable)

1. Vehicle normalization helper + `normalized_number` + resolve-or-create;
   populate `voucher.vehicle_id` on create/edit. (backend + DB rebuild)
2. Live balance read model; switch customer read sites; keep cache writer.
3. Vehicle ledger endpoint + response outstanding.
4. FIFO vehicle scoping.
5. Frontend: VehicleAutocomplete → forms.
6. Frontend: vehicle ledger page + table actions + route.
7. Frontend: payment vehicle field; customer voucher grouping by vehicle.
8. Tests + build + graphify update.

## Open risks / call-outs

- **Blast radius of live balances** is the biggest risk (~17 read sites). Kept
  contained by leaving the cached column in place as a fallback the ledger
  writer still maintains, and switching reads deliberately per-site.
- Adjustments remain customer-level; the vehicle view shows them as shared
  account activity, not per-vehicle (documented above) — this is the honest
  interpretation of requirement 5 without a second drift-prone ledger.
- `Vehicle.vehicle_number` is globally unique today; normalization must not
  collapse two genuinely different customers' plates. Uniqueness stays global
  (a plate is a plate), matching the "one vehicle, one history" intent.
