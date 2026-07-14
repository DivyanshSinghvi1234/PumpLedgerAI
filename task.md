# Task List - Fuel Dispenser CRUD, Meter Logs & Rollover Fix

- [x] Rename `SPEED_PETROL` to `SPEED` in backend `enums.py`
- [x] Add `FuelDispenserUpdate` schema in backend `schemas/nozzle.py`
- [x] Implement dispenser update and delete in backend `services/nozzle_service.py`
- [x] Implement dispenser update, delete, and list readings routes in backend `api/v1/routes/nozzle.py`
- [x] Reset database for clean initialization with `SPEED` enum
- [x] Rename `SPEED_PETROL` to `SPEED` in frontend `types.ts`
- [x] Implement frontend updates, deletes, and list readings in `features/inventory/services/inventoryService.ts`
- [x] Add edit/delete buttons, logs tab, and global cache invalidation to `features/inventory/InventoryPage.tsx`
- [x] Run typecheck and verify correct operation
