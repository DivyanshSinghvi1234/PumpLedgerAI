import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormDatePicker from "@/components/forms/FormDatePicker";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import { getTodayDateString } from "@/lib/utils";

import { useCreateIncome } from "../hooks/useCreateIncome";
import { useUpdateIncome } from "../hooks/useUpdateIncome";
import { useIncomeCategories } from "../hooks/useIncomeCategories";
import type { Income, IncomeKind, PaymentMode } from "../types/income";

// Enum values mirror the backend (app/core/enums.py).
const FUEL_OPTIONS = [
  { label: "None", value: "" },
  { label: "Petrol", value: "PETROL" },
  { label: "Speed", value: "SPEED" },
  { label: "Diesel", value: "DIESEL" },
  { label: "Lubricant", value: "LUBRICANT" },
];

const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Credit", value: "CREDIT" },
];

const entrySchema = z.object({
  income_date: z.string().min(1, "Date is required"),

  description: z.string().min(1, "Describe what this is for"),

  amount: z.coerce.number().positive("Amount must be greater than 0"),

  // Optional free-text category.
  category: z.string().optional(),

  payment_mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),

  fuel_type: z.string().optional(),

  quantity_liters: z.coerce.number().optional(),

  rate_per_liter: z.coerce.number().optional(),
});

type EntryFormInput = z.input<typeof entrySchema>;
type EntryFormData = z.output<typeof entrySchema>;

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** INCOME = money in, EXPENSE = money out (only expenses can be a loan). */
  kind: IncomeKind;
  /** Prefill the date with the day currently being viewed. */
  defaultDate: string;
  /** Optional prefill for preset entries (e.g. a bank deposit). */
  preset?: { title?: string; description?: string; category?: string };
  /** Optional entry to edit. */
  incomeToEdit?: Income;
}

export default function AddEntryDialog({
  open,
  onOpenChange,
  kind,
  defaultDate,
  preset,
  incomeToEdit,
}: Props) {
  const activeKind = incomeToEdit ? incomeToEdit.kind : kind;
  const isExpense = activeKind === "EXPENSE";

  const createMutation = useCreateIncome();
  const updateMutation = useUpdateIncome();

  // Previously-used category names power the datalist autocomplete.
  const { data: categories = [] } = useIncomeCategories();

  const [lend, setLend] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerUuid, setCustomerUuid] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EntryFormInput, unknown, EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      income_date: defaultDate || getTodayDateString(),
      payment_mode: "CASH",
    },
  });

  const [isSale, setIsSale] = useState(activeKind === "INCOME");
  const [fuelItems, setFuelItems] = useState<
    { id: string; fuel_type: string; quantity_liters: string; rate_per_liter: string }[]
  >([]);

  const watchAmount = watch("amount");
  const watchQty = watch("quantity_liters");
  const watchRate = watch("rate_per_liter");

  // Calculate sum of fuel items if present, or single qty * rate
  const calculatedFuelSum = useMemo(() => {
    if (fuelItems.length > 0) {
      return fuelItems.reduce((sum, item) => {
        const q = Number(item.quantity_liters) || 0;
        const r = Number(item.rate_per_liter) || 0;
        return sum + q * r;
      }, 0);
    }
    const q = Number(watchQty) || 0;
    const r = Number(watchRate) || 0;
    return q > 0 && r > 0 ? q * r : 0;
  }, [fuelItems, watchQty, watchRate]);

  const isMismatch = useMemo(() => {
    const amt = Number(watchAmount) || 0;
    if (calculatedFuelSum > 0 && amt > 0) {
      return Math.abs(calculatedFuelSum - amt) > 1.0;
    }
    return false;
  }, [calculatedFuelSum, watchAmount]);

  useEffect(() => {
    if (calculatedFuelSum > 0 && (!watchAmount || fuelItems.length > 0)) {
      setValue("amount", Number(calculatedFuelSum.toFixed(2)));
    }
  }, [calculatedFuelSum, setValue]);

  // Reset the form each time the dialog opens or incomeToEdit changes so the values sync.
  useEffect(() => {
    if (open) {
      reset({
        income_date: incomeToEdit?.income_date || defaultDate || getTodayDateString(),
        description: incomeToEdit?.description ?? preset?.description ?? "",
        amount: incomeToEdit?.amount ?? undefined,
        category: incomeToEdit?.category ?? preset?.category ?? "",
        payment_mode: incomeToEdit?.payment_mode ?? "CASH",
        fuel_type: incomeToEdit?.fuel_type ?? "",
        quantity_liters: incomeToEdit?.quantity_liters ?? undefined,
        rate_per_liter: incomeToEdit?.rate_per_liter ?? undefined,
      });
      setIsSale(incomeToEdit ? !!incomeToEdit.is_sale : activeKind === "INCOME");
      if (incomeToEdit?.items && Array.isArray(incomeToEdit.items)) {
        setFuelItems(
          incomeToEdit.items.map((i, idx) => ({
            id: String(idx),
            fuel_type: i.fuel_type,
            quantity_liters: i.quantity_liters ? String(i.quantity_liters) : "",
            rate_per_liter: i.rate_per_liter ? String(i.rate_per_liter) : "",
          }))
        );
      } else {
        setFuelItems([]);
      }
      setLend(!!incomeToEdit?.customer_uuid);
      setCustomerName(incomeToEdit?.customer_name ?? "");
      setCustomerUuid(incomeToEdit?.customer_uuid ?? null);
      setCustomerError(null);
    } else {
      createMutation.reset();
      updateMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, incomeToEdit]);

  const addFuelItem = () => {
    setFuelItems((prev) => [
      ...prev,
      { id: Date.now().toString(), fuel_type: "PETROL", quantity_liters: "", rate_per_liter: "" },
    ]);
  };

  const removeFuelItem = (id: string) => {
    setFuelItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateFuelItem = (id: string, field: string, value: string) => {
    setFuelItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  async function submitForm(data: EntryFormData) {
    setCustomerError(null);

    const lendName = customerName.trim();
    if (isExpense && lend && !customerUuid && !lendName) {
      setCustomerError(
        "Enter a customer to lend to (existing or new — it'll be created on save)."
      );
      return;
    }

    const formattedItems = fuelItems
      .filter((i) => i.fuel_type)
      .map((i) => ({
        fuel_type: i.fuel_type as any,
        quantity_liters: i.quantity_liters ? Number(i.quantity_liters) : null,
        rate_per_liter: i.rate_per_liter ? Number(i.rate_per_liter) : null,
        amount: Number(i.quantity_liters || 0) * Number(i.rate_per_liter || 0) || null,
      }));

    const payload = {
      kind: activeKind,
      income_date: data.income_date,
      description: data.description,
      amount: data.amount,
      category: data.category?.trim() || null,
      payment_mode: data.payment_mode,
      fuel_type: (data.fuel_type as any) || null,
      quantity_liters: data.quantity_liters ? Number(data.quantity_liters) : null,
      rate_per_liter: data.rate_per_liter ? Number(data.rate_per_liter) : null,
      is_sale: activeKind === "INCOME" ? isSale : false,
      items: formattedItems.length > 0 ? formattedItems : null,
      customer_uuid: isExpense && lend ? customerUuid : null,
      customer_name: isExpense && lend && !customerUuid ? lendName : null,
    };

    try {
      if (incomeToEdit) {
        await updateMutation.mutateAsync({
          uuid: incomeToEdit.uuid,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // onError in the mutation hook already shows a toast.
    }
  }

  const title = preset?.title ?? (incomeToEdit ? `Edit ${activeKind === "DEPOSIT" ? "Deposit" : isExpense ? "Expense" : "Revenue"}` : kind === "DEPOSIT" ? "Add Deposit" : isExpense ? "Add Expense / Variable" : "Add Revenue");
  const descriptionPlaceholder = activeKind === "DEPOSIT"
    ? "e.g. Cash deposited in SBI"
    : isExpense
      ? "e.g. Generator diesel, staff advance, repairs"
      : "e.g. Oil sale, UPI petrol sale, scrap sale";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid-cols-1 w-full max-w-2xl bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="mb-6 text-xl font-semibold">
          {title}
        </DialogTitle>

        <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
          {/* Sale vs Other Revenue toggle */}
          {activeKind === "INCOME" && (
            <div className="rounded-xl border border-hairline bg-surface-2/60 p-3 flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-ink flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSale}
                    onChange={(e) => setIsSale(e.target.checked)}
                    className="h-4 w-4 rounded border-hairline"
                  />
                  Direct Counter / Fuel Sale
                </label>
                <p className="text-xs text-ink-muted mt-0.5">
                  {isSale
                    ? "Part of daily sales: non-cash payments (UPI/Card/Credit) automatically deduct from Cash in Hand."
                    : "Other revenue (e.g. scrap sale, rent): adds to Bank/UPI total without deducting from Cash in Hand."}
                </p>
              </div>
            </div>
          )}

          <FormInput
            label="What is this for?"
            required
            placeholder={descriptionPlaceholder}
            error={errors.description?.message}
            {...register("description")}
          />

          {/* Optional Multi-Fuel Items */}
          <div className="rounded-xl border border-hairline bg-surface-2/40 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Fuel Parameters (Optional)
              </p>
              <button
                type="button"
                onClick={addFuelItem}
                className="text-xs font-semibold text-fuel-amber hover:underline cursor-pointer"
              >
                + Add Multiple Fuel Types
              </button>
            </div>

            {fuelItems.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormSelect
                  label="Fuel Type"
                  options={FUEL_OPTIONS}
                  {...register("fuel_type")}
                />
                <FormInput
                  type="number"
                  step="0.001"
                  label="Quantity (Liters)"
                  placeholder="e.g. 50"
                  {...register("quantity_liters")}
                />
                <FormInput
                  type="number"
                  step="0.01"
                  label="Rate / Liter (₹)"
                  placeholder="e.g. 100.00"
                  {...register("rate_per_liter")}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {fuelItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end bg-card p-2 rounded-lg border border-hairline">
                    <FormSelect
                      label="Fuel Type"
                      options={FUEL_OPTIONS.filter((o) => o.value !== "")}
                      value={item.fuel_type}
                      onChange={(e) => updateFuelItem(item.id, "fuel_type", e.target.value)}
                    />
                    <FormInput
                      type="number"
                      step="0.001"
                      label="Liters"
                      placeholder="e.g. 50"
                      value={item.quantity_liters}
                      onChange={(e) => updateFuelItem(item.id, "quantity_liters", e.target.value)}
                    />
                    <FormInput
                      type="number"
                      step="0.01"
                      label="Rate/L (₹)"
                      placeholder="e.g. 100"
                      value={item.rate_per_liter}
                      onChange={(e) => updateFuelItem(item.id, "rate_per_liter", e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-ink">
                        ₹{((Number(item.quantity_liters) || 0) * (Number(item.rate_per_liter) || 0)).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFuelItem(item.id)}
                        className="text-xs text-error hover:underline ml-auto"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FormInput
                type="number"
                step="0.01"
                label="Amount (Handwritten / Final ₹)"
                required
                error={errors.amount?.message}
                {...register("amount")}
              />
              {isMismatch && (
                <p className="mt-1 text-xs text-amber-500 font-semibold flex items-center gap-1">
                  <span>⚠️ Handwritten amount (₹{watchAmount}) differs from calculated total (₹{calculatedFuelSum.toFixed(2)}). Will be flagged as Mismatch.</span>
                </p>
              )}
            </div>

            <FormSelect
              label="Payment Mode"
              options={PAYMENT_OPTIONS}
              error={errors.payment_mode?.message}
              {...register("payment_mode")}
            />

            <FormDatePicker
              label="Date"
              required
              error={errors.income_date?.message}
              {...register("income_date")}
            />

            {/* Free-text category with autocomplete of prior categories. */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Category (optional)
              </label>
              <input
                list="entry-categories"
                placeholder="e.g. Expense, Misc sale"
                className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-tertiary focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20"
                {...register("category")}
              />
              <datalist id="entry-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Lending — expense only. Links the expense to a customer so the
              amount posts as a debit (outstanding balance) on their ledger. */}
          {isExpense && (
            <div className="space-y-3 rounded-xl border border-hairline bg-surface-2/50 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={lend}
                  onChange={(e) => setLend(e.target.checked)}
                  className="h-4 w-4 rounded border-hairline"
                />
                This is money lent to a customer (adds to their balance)
              </label>

              {lend && (
                <CustomerAutocomplete
                  value={customerName}
                  customerUuid={customerUuid}
                  error={customerError ?? undefined}
                  onChange={(name, uuid) => {
                    setCustomerName(name);
                    setCustomerUuid(uuid);
                    setCustomerError(null);
                  }}
                />
              )}
            </div>
          )}

          <FormActions
            loading={createMutation.isPending || updateMutation.isPending}
            onCancel={() => onOpenChange(false)}
            submitLabel={incomeToEdit ? "Save Changes" : activeKind === "DEPOSIT" ? "Save Deposit" : isExpense ? "Save Expense" : "Save Revenue"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
