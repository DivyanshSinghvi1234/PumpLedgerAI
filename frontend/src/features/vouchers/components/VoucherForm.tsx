import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormTextarea from "@/components/forms/FormTextarea";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";

import type {
  CreateVoucherRequest,
  FuelType,
  PaymentMode,
} from "@/types/voucher";

// Enum values mirror the backend (app/core/enums.py).
const FUEL_OPTIONS: { label: string; value: FuelType }[] = [
  { label: "Petrol", value: "PETROL" },
  { label: "Diesel", value: "DIESEL" },
  { label: "Lubricant", value: "LUBRICANT" },
];

const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Credit", value: "CREDIT" },
];

const voucherSchema = z.object({
  invoice_number: z
    .string()
    .min(1, "Invoice number is required"),

  invoice_date: z
    .string()
    .min(1, "Invoice date is required"),

  vehicle_number: z.string().optional(),

  customer_name: z.string().optional(),

  customer_uuid: z.string().optional(),

  fuel_type: z.enum(["PETROL", "DIESEL", "LUBRICANT"]),

  quantity_liters: z.coerce
    .number()
    .positive("Quantity must be greater than 0"),

  rate_per_liter: z.coerce
    .number()
    .positive("Rate must be greater than 0"),

  total_amount: z.coerce
    .number()
    .positive("Total must be greater than 0"),

  payment_mode: z.enum(["CASH", "UPI", "CARD", "CREDIT"]),

  remarks: z.string().optional(),
});

type VoucherFormData = z.output<typeof voucherSchema>;

type VoucherFormInput = z.input<typeof voucherSchema>;

interface Props {
  defaultValues?: Partial<VoucherFormData>;

  loading?: boolean;

  onCancel?(): void;

  onSubmit(
    data: CreateVoucherRequest
  ): void | Promise<void>;
}

export default function VoucherForm({
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
    VoucherFormInput,
    unknown,
    VoucherFormData
  >({
    resolver: zodResolver(voucherSchema),

    defaultValues: {
      fuel_type: "PETROL",
      payment_mode: "CASH",
      ...defaultValues,
    },
  });

  const customerName = watch("customer_name") ?? "";
  const customerUuid = watch("customer_uuid") ?? "";

  function submitForm(
    data: VoucherFormData
  ) {
    // Empty string from the "None" option → no linked customer.
    const payload = {
      ...data,
      customer_uuid: data.customer_uuid || null,
    };

    return onSubmit(payload);
  }

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-2 gap-4">

        <FormInput
          label="Invoice Number"
          required
          error={errors.invoice_number?.message}
          {...register("invoice_number")}
        />

        <FormInput
          type="date"
          label="Invoice Date"
          required
          error={errors.invoice_date?.message}
          {...register("invoice_date")}
        />

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

        <FormInput
          label="Vehicle Number"
          error={errors.vehicle_number?.message}
          {...register("vehicle_number")}
        />

        <FormSelect
          label="Fuel Type"
          options={FUEL_OPTIONS}
          error={errors.fuel_type?.message}
          {...register("fuel_type")}
        />

        <FormSelect
          label="Payment Mode"
          options={PAYMENT_OPTIONS}
          error={errors.payment_mode?.message}
          {...register("payment_mode")}
        />

        <FormInput
          type="number"
          step="0.001"
          label="Quantity (Liters)"
          required
          error={errors.quantity_liters?.message}
          {...register("quantity_liters")}
        />

        <FormInput
          type="number"
          step="0.01"
          label="Rate / Liter"
          required
          error={errors.rate_per_liter?.message}
          {...register("rate_per_liter")}
        />

        <FormInput
          type="number"
          step="0.01"
          label="Total Amount"
          required
          error={errors.total_amount?.message}
          {...register("total_amount")}
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
        submitLabel="Save Voucher"
      />

    </form>
  );
}
