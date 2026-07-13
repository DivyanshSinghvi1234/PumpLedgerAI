import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormTextarea from "@/components/forms/FormTextarea";

import type {
  CreatePaymentRequest,
  PaymentMode,
} from "../types/payment";

interface CustomerOption {
  label: string;
  value: string;
}

// Enum values mirror the backend (app/core/enums.py).
const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Credit", value: "CREDIT" },
];

const paymentSchema = z.object({
  customer_uuid: z
    .string()
    .min(1, "Customer is required"),

  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0"),

  payment_mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),

  payment_date: z
    .string()
    .min(1, "Payment date is required"),

  reference_number: z.string().optional(),

  remarks: z.string().optional(),
});

type PaymentFormData = z.output<typeof paymentSchema>;

type PaymentFormInput = z.input<typeof paymentSchema>;

interface Props {
  customerOptions: CustomerOption[];

  defaultValues?: Partial<PaymentFormData>;

  loading?: boolean;

  onCancel?(): void;

  onSubmit(
    data: CreatePaymentRequest
  ): void | Promise<void>;
}

export default function PaymentForm({
  customerOptions,
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
    PaymentFormInput,
    unknown,
    PaymentFormData
  >({
    resolver: zodResolver(paymentSchema),

    defaultValues: {
      payment_mode: "CASH",
      ...defaultValues,
    },
  });

  function submitForm(
    data: PaymentFormData
  ) {
    return onSubmit(data);
  }

  // A leading placeholder so the select doesn't silently default
  // to the first customer.
  const customerSelectOptions = [
    { label: "Select customer...", value: "" },
    ...customerOptions,
  ];

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-2 gap-4">

        <div className="col-span-2">
          <FormSelect
            label="Customer"
            options={customerSelectOptions}
            error={errors.customer_uuid?.message}
            {...register("customer_uuid")}
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

        <FormSelect
          label="Payment Mode"
          options={PAYMENT_OPTIONS}
          error={errors.payment_mode?.message}
          {...register("payment_mode")}
        />

        <FormInput
          type="date"
          label="Payment Date"
          required
          error={errors.payment_date?.message}
          {...register("payment_date")}
        />

        <FormInput
          label="Reference Number"
          error={errors.reference_number?.message}
          {...register("reference_number")}
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
        submitLabel="Save Payment"
      />

    </form>
  );
}
