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
import { useIncomeCategories } from "../hooks/useIncomeCategories";
import type { IncomeKind, PaymentMode } from "../types/income";

// Enum values mirror the backend (app/core/enums.py).
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

  // Optional free-text category (see the categories corner-cut on the page).
  category: z.string().optional(),

  payment_mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),
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
}

export default function AddEntryDialog({
  open,
  onOpenChange,
  kind,
  defaultDate,
  preset,
}: Props) {
  const isExpense = kind === "EXPENSE";

  const createMutation = useCreateIncome();

  // Previously-used category names power the datalist autocomplete.
  const { data: categories = [] } = useIncomeCategories();

  // Optional customer link — only for an expense that is a loan. Kept in local
  // state (like the no-bill sale dialog) because CustomerAutocomplete is not a
  // register()-style input.
  const [lend, setLend] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerUuid, setCustomerUuid] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EntryFormInput, unknown, EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      income_date: defaultDate || getTodayDateString(),
      payment_mode: "CASH",
    },
  });

  // Reset the form each time the dialog opens so the date tracks the view.
  useEffect(() => {
    if (open) {
      reset({
        income_date: defaultDate || getTodayDateString(),
        description: preset?.description ?? "",
        amount: undefined,
        category: preset?.category ?? "",
        payment_mode: "CASH",
      });
      setLend(false);
      setCustomerName("");
      setCustomerUuid(null);
      setCustomerError(null);
    } else {
      createMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate]);

  async function submitForm(data: EntryFormData) {
    setCustomerError(null);

    // Lending needs a customer to charge. A linked uuid targets an existing
    // ledger; a typed-but-unlinked name is fine too — the backend
    // resolve-or-creates the customer by name. Only a blank name is invalid.
    const lendName = customerName.trim();
    if (isExpense && lend && !customerUuid && !lendName) {
      setCustomerError(
        "Enter a customer to lend to (existing or new — it'll be created on save)."
      );
      return;
    }

    await createMutation.mutateAsync({
      kind,
      income_date: data.income_date,
      description: data.description,
      amount: data.amount,
      category: data.category?.trim() || null,
      payment_mode: data.payment_mode,
      customer_uuid: isExpense && lend ? customerUuid : null,
      customer_name: isExpense && lend && !customerUuid ? lendName : null,
    });

    onOpenChange(false);
  }

  const title = preset?.title ?? (isExpense ? "Add Expense / Variable" : "Add Income / Variable");
  const descriptionPlaceholder = isExpense
    ? "e.g. Generator diesel, staff advance, repairs"
    : "e.g. Oil sale, scrap sale, misc receipt";

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              type="number"
              step="0.01"
              label="Amount"
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
            loading={createMutation.isPending}
            onCancel={() => onOpenChange(false)}
            submitLabel={isExpense ? "Save Expense" : "Save Income"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
