import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormTextarea from "@/components/forms/FormTextarea";
import FormDatePicker from "@/components/forms/FormDatePicker";
import { getTodayDateString } from "@/lib/utils";

import type {
  AdjustmentType,
  CreateAdjustmentRequest,
} from "../types/ledger";

const TYPE_OPTIONS: { label: string; value: AdjustmentType }[] = [
  {
    label: "Debit (increase dues)",
    value: "DEBIT_ADJUSTMENT",
  },
  {
    label: "Credit (reduce dues)",
    value: "CREDIT_ADJUSTMENT",
  },
];

const adjustmentSchema = z.object({
  entry_type: z.enum([
    "DEBIT_ADJUSTMENT",
    "CREDIT_ADJUSTMENT",
  ]),

  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0"),

  entry_date: z
    .string()
    .min(1, "Date is required"),

  remarks: z.string().optional(),
});

type AdjustmentFormData = z.output<typeof adjustmentSchema>;

type AdjustmentFormInput = z.input<typeof adjustmentSchema>;

interface Props {
  defaultValues?: Partial<AdjustmentFormData>;

  loading?: boolean;

  onCancel?(): void;

  onSubmit(
    data: CreateAdjustmentRequest
  ): void | Promise<void>;
}

export default function AdjustmentForm({
  defaultValues,
  loading = false,
  onCancel,
  onSubmit,
}: Props) {

  const {
    register,
    handleSubmit,
    formState: {
      errors,
    },
  } = useForm<
    AdjustmentFormInput,
    unknown,
    AdjustmentFormData
  >({
    resolver: zodResolver(adjustmentSchema),

    defaultValues: {
      entry_type: "DEBIT_ADJUSTMENT",
      entry_date: getTodayDateString(),
      ...defaultValues,
    },
  });

  function submitForm(
    data: AdjustmentFormData
  ) {
    return onSubmit(data);
  }

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="col-span-1 sm:col-span-2">
          <FormSelect
            label="Adjustment Type"
            options={TYPE_OPTIONS}
            error={errors.entry_type?.message}
            {...register("entry_type")}
          />
        </div>

        <FormInput
          type="number"
          step="0.01"
          label="Amount"
          required
          error={errors.amount?.message}
          {...register("amount")}
        />

        <FormDatePicker
          label="Date"
          required
          error={errors.entry_date?.message}
          {...register("entry_date")}
        />

      </div>

      <FormTextarea
        label="Remarks"
        rows={3}
        error={errors.remarks?.message}
        {...register("remarks")}
      />

      <FormActions
        loading={loading}
        onCancel={onCancel}
        submitLabel="Post Adjustment"
      />

    </form>
  );
}
