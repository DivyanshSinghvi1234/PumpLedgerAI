import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormTextarea from "@/components/forms/FormTextarea";
import FormDatePicker from "@/components/forms/FormDatePicker";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import { getTodayDateString } from "@/lib/utils";

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

  customer_name: z.string().optional(),

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
  defaultValues,
  loading = false,
  onCancel,
  onSubmit,
}: Props) {

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
      payment_date: getTodayDateString(),
      ...defaultValues,
    },
  });

  const customerName = watch("customer_name") ?? "";
  const customerUuid = watch("customer_uuid") ?? "";

  function submitForm(
    data: PaymentFormData
  ) {
    return onSubmit({
      customer_uuid: data.customer_uuid,
      amount: data.amount,
      payment_mode: data.payment_mode,
      payment_date: data.payment_date,
      reference_number: data.reference_number,
      remarks: data.remarks,
    });
  }

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="col-span-1 sm:col-span-2">
          <CustomerAutocomplete
            value={customerName}
            customerUuid={customerUuid || null}
            error={
              errors.customer_name?.message ??
              errors.customer_uuid?.message
            }
            onChange={(name, uuid) => {
              setValue("customer_name", name, {
                shouldValidate: true,
              });
              setValue("customer_uuid", uuid ?? "", {
                shouldValidate: true,
              });
            }}
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

        <FormDatePicker
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
