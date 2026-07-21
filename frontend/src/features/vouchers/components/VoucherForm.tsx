import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";
import FormTextarea from "@/components/forms/FormTextarea";
import FormDatePicker from "@/components/forms/FormDatePicker";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import VehicleAutocomplete from "@/features/vehicles/components/VehicleAutocomplete";
import { getTodayDateString } from "@/lib/utils";

import type {
  CreateVoucherRequest,
  FuelType,
  PaymentMode,
} from "@/types/voucher";

// Enum values mirror the backend (app/core/enums.py).
const FUEL_OPTIONS: { label: string; value: FuelType }[] = [
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

  fuel_type: z.enum(["PETROL", "SPEED", "DIESEL", "LUBRICANT"]),

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
      invoice_date: getTodayDateString(),
      ...defaultValues,
    },
  });

  const customerName = watch("customer_name") ?? "";
  const customerUuid = watch("customer_uuid") ?? "";
  const vehicleNumber = watch("vehicle_number") ?? "";

  const qty = watch("quantity_liters") ?? 0;
  const rate = watch("rate_per_liter") ?? 0;
  const totalAmount = watch("total_amount") ?? 0;

  const expectedAmount = Number((Number(qty) * Number(rate)).toFixed(2));
  const diff = Number(Math.abs(Number(totalAmount) - expectedAmount).toFixed(2));
  const isMismatch = Number(qty) > 0 && Number(rate) > 0 && diff > 0.05;

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <FormInput
          label="Invoice Number"
          required
          error={errors.invoice_number?.message}
          {...register("invoice_number")}
        />

        <FormDatePicker
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
            if (uuid) {
              setValue("payment_mode", "CREDIT", {
                shouldValidate: true,
              });
            }
          }}
        />

        <VehicleAutocomplete
          value={vehicleNumber}
          error={errors.vehicle_number?.message}
          onChange={(number, vehicle) => {
            setValue("vehicle_number", number, {
              shouldValidate: true,
            });
            // Picking an existing vehicle auto-fills its owning customer and
            // defaults to a credit sale, matching the customer picker.
            if (vehicle) {
              setValue("customer_name", vehicle.customer_name, {
                shouldValidate: true,
              });
              setValue("customer_uuid", vehicle.customer_uuid, {
                shouldValidate: true,
              });
              setValue("payment_mode", "CREDIT", {
                shouldValidate: true,
              });
            }
          }}
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

        <div>
          <FormInput
            type="number"
            step="0.01"
            label="Total Amount"
            required
            error={errors.total_amount?.message}
            {...register("total_amount")}
          />
          {isMismatch && (
            <p className="mt-1.5 text-xs font-semibold text-amber-500">
              ⚠️ Amount Mismatch: Calculated expected amount is ₹{expectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} (Difference: ₹{diff.toLocaleString("en-IN", { minimumFractionDigits: 2 })}).
            </p>
          )}
        </div>

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
