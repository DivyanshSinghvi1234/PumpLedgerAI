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

  const watchQty = watch("quantity_liters");
  const watchRate = watch("rate_per_liter");

  useEffect(() => {
    const qty = Number(watchQty) || 0;
    const rate = Number(watchRate) || 0;
    if (qty > 0 && rate > 0) {
      setValue("amount", Number((qty * rate).toFixed(2)));
    }
  }, [watchQty, watchRate, setValue]);

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

  async function submitForm(data: EntryFormData) {
    setCustomerError(null);

    const lendName = customerName.trim();
    if (isExpense && lend && !customerUuid && !lendName) {
      setCustomerError(
        "Enter a customer to lend to (existing or new — it'll be created on save)."
      );
      return;
    }

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
      <DialogContent className="grid-cols-1 w-full max-w-2xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          {title}
        </DialogTitle>

        <form onSubmit={handleSubmit(submitForm)} className="space-y-4">
          <FormInput
            label="What is this for?"
            required
            placeholder={descriptionPlaceholder}
            error={errors.description?.message}
            {...register("description")}
          />

          {/* Optional Fuel Details */}
          <div className="rounded-xl border border-hairline bg-surface-2/40 p-3 space-y-3">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Fuel Sale Parameters (Optional)
            </p>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              type="number"
              step="0.01"
              label="Amount (₹)"
              required
              error={errors.amount?.message}
              {...register("amount")}
            />

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
