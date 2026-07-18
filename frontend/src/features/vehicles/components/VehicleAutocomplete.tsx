import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import vehicleService from "../services/vehicleService";
import type { Vehicle } from "../types/vehicle";

interface Props {
  /** Current free-text vehicle number. */
  value: string;

  /**
   * Report a change. `vehicle` is the picked existing vehicle (so the caller
   * can auto-fill its customer), or null once the user edits the text so it no
   * longer matches a record. The backend resolves-or-creates the vehicle by
   * number on save, so an unlinked value is fine.
   */
  onChange(vehicleNumber: string, vehicle: Vehicle | null): void;

  label?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Type-ahead vehicle picker mirroring CustomerAutocomplete. As the user types
 * a number it queries the vehicle search and shows matches with their owning
 * customer and live outstanding. Picking one lets the caller auto-fill the
 * customer; typing a novel number leaves it unlinked and the backend
 * auto-creates the vehicle on save.
 */
export default function VehicleAutocomplete({
  value,
  onChange,
  label = "Vehicle Number",
  error,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  // Debounce the query term so we don't fire a request on every keystroke.
  const [term, setTerm] = useState(value);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setTerm(value.trim()), 250);
    return () => clearTimeout(id);
  }, [value]);

  const { data, isFetching } = useQuery({
    queryKey: ["vehicles", "search", term],
    queryFn: () =>
      vehicleService.getVehicles({
        search: term || undefined,
        page: 1,
        page_size: 5,
      }),
    enabled: term.length > 0,
    staleTime: 30_000,
  });

  const matches = useMemo<Vehicle[]>(
    () => data?.items ?? [],
    [data],
  );

  // Close the dropdown when clicking outside the component.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () =>
      document.removeEventListener("mousedown", onClick);
  }, []);

  // Does the current text exactly (case-insensitively, ignoring spaces) match
  // a known vehicle? Vehicle numbers are compared loosely since users type
  // them with varying spacing.
  const normalized = value.replace(/\s+/g, "").toLowerCase();

  const linkedMatch = useMemo(() => {
    if (!normalized) return null;

    return (
      matches.find(
        (v) =>
          v.vehicle_number.replace(/\s+/g, "").toLowerCase() ===
          normalized,
      ) ?? null
    );
  }, [matches, normalized]);

  const isExisting = Boolean(linkedMatch);

  const formattedOutstanding = useMemo(() => {
    const bal = linkedMatch?.outstanding_balance;
    if (bal === undefined || bal === null) return null;
    return Number(bal).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [linkedMatch]);

  function handlePick(vehicle: Vehicle) {
    onChange(vehicle.vehicle_number, vehicle);
    setOpen(false);
  }

  function handleType(next: string) {
    // Editing the text breaks any previous explicit link.
    onChange(next, null);
    setOpen(true);
  }

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-sm font-medium">{label}</label>

      <div className="relative">
        <input
          value={value}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-muted"
          placeholder="Start typing a vehicle number…"
        />

        {open && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {isFetching && matches.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Searching…
              </p>
            )}

            {!isFetching && matches.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No matching vehicles — will be created as new.
              </p>
            )}

            {matches.map((vehicle) => (
              <button
                key={vehicle.uuid}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(vehicle)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
              >
                <span className="text-sm font-medium">
                  {vehicle.vehicle_number}
                </span>

                <span className="text-xs text-muted-foreground">
                  {[
                    vehicle.customer_name,
                    vehicle.vehicle_type,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No customer / type"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Existing vs new indicator */}
      {value.trim().length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p
            className={`text-xs font-medium ${
              isExisting ? "text-green-600" : "text-amber-600"
            }`}
          >
            {isExisting
              ? `✓ Existing vehicle — ${linkedMatch?.customer_name}`
              : "+ New vehicle (will be created on save)"}
          </p>
          {isExisting && formattedOutstanding !== null && (
            <p className="text-xs font-semibold text-blue-600">
              Vehicle Outstanding: ₹{formattedOutstanding}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
