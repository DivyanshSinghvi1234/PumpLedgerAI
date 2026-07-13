import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";

import customerService from "../services/customerService";
import type { Customer } from "../types/customer";

interface Props {
  /** Current free-text customer name. */
  value: string;

  /** UUID of the linked existing customer, or null for a new/walk-in name. */
  customerUuid: string | null;

  /**
   * Report a change. `uuid` is set when the user picks an existing customer
   * from the dropdown, and cleared to null as soon as they edit the text
   * (so it no longer matches that record).
   */
  onChange(name: string, uuid: string | null): void;

  label?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Type-ahead customer picker. As the user types a name it queries the
 * backend customer search and shows matching existing customers. Picking one
 * links the voucher to that customer (sets `customerUuid`); typing a name
 * with no match leaves it unlinked — the backend then auto-creates the
 * customer on save. A line below the field shows whether the current name
 * resolves to an existing customer or a new one.
 */
export default function CustomerAutocomplete({
  value,
  customerUuid,
  onChange,
  label = "Customer Name",
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
    queryKey: ["customers", "search", term],
    queryFn: () =>
      customerService.getCustomers({
        search: term,
        page: 1,
        page_size: 8,
      }),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });

  const matches = useMemo<Customer[]>(
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

  // Does the current name exactly (case-insensitively) match a known
  // customer? Prefer the explicitly-linked uuid; otherwise check matches.
  const linkedMatch = useMemo(() => {
    if (customerUuid) {
      return (
        matches.find((c) => c.uuid === customerUuid) ?? {
          uuid: customerUuid,
          name: value,
        }
      );
    }

    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;

    return (
      matches.find(
        (c) => c.name.trim().toLowerCase() === trimmed,
      ) ?? null
    );
  }, [customerUuid, matches, value]);

  const isExisting = Boolean(linkedMatch);

  function handlePick(customer: Customer) {
    onChange(customer.name, customer.uuid);
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
          placeholder="Start typing a customer name…"
        />

        {open && value.trim().length >= 2 && (
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
            {isFetching && matches.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Searching…
              </p>
            )}

            {!isFetching && matches.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No matching customers — will be created as new.
              </p>
            )}

            {matches.map((customer) => (
              <button
                key={customer.uuid}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(customer)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
              >
                <span className="text-sm font-medium">
                  {customer.name}
                </span>

                <span className="text-xs text-muted-foreground">
                  {[
                    customer.customer_code,
                    customer.mobile,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No code / mobile"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Existing vs new indicator */}
      {value.trim().length > 0 && (
        <p
          className={`text-xs font-medium ${
            isExisting ? "text-green-600" : "text-amber-600"
          }`}
        >
          {isExisting
            ? "✓ Existing customer"
            : "+ New customer (will be created on save)"}
        </p>
      )}

      {/*
        When the typed name is NOT an exact match but similar customers
        exist, surface them inline (no click needed) so the user links to an
        existing record instead of creating a near-duplicate. This is what
        prevents "MAHAVEER" / "MAHAVEER SHAR" splitting into separate rows.
      */}
      {!isExisting &&
        !disabled &&
        value.trim().length >= 2 &&
        matches.length > 0 && (
          <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 p-2">
            <p className="mb-1 text-xs font-medium text-amber-800">
              Did you mean an existing customer? Click to link
              instead of creating a new one:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {matches.slice(0, 5).map((customer) => (
                <button
                  key={customer.uuid}
                  type="button"
                  onClick={() => handlePick(customer)}
                  className="rounded-full border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                >
                  {customer.name}
                  {customer.customer_code
                    ? ` (${customer.customer_code})`
                    : ""}
                </button>
              ))}
            </div>
          </div>
        )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
