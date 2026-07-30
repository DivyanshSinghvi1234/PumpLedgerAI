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
import { enqueueOfflineTransaction } from "@/lib/offlineQueue";
import { toast } from "sonner";



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
  { label: "Split (Multi-Payment)", value: "SPLIT" },
];

const voucherSchema = z
  .object({
    invoice_number: z
      .string()
      .min(1, "Invoice number is required"),

    invoice_date: z
      .string()
      .min(1, "Invoice date is required"),

    vehicle_number: z.string().optional().or(z.literal("")),

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

    payment_mode: z.enum(["CASH", "UPI", "CARD", "CREDIT", "SPLIT"]),

    cash_amount: z.coerce.number().min(0).optional(),
    upi_amount: z.coerce.number().min(0).optional(),
    card_amount: z.coerce.number().min(0).optional(),
    credit_amount: z.coerce.number().min(0).optional(),

    remarks: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Amount mismatch check (Quantity * Rate matches Total within ₹1)
    if (data.quantity_liters && data.rate_per_liter && data.total_amount) {
      const expected = data.quantity_liters * data.rate_per_liter;
      if (Math.abs(expected - data.total_amount) > 1.0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Total amount doesn't match Quantity x Rate (expected: ₹${expected.toFixed(2)})`,
          path: ["total_amount"],
        });
      }
    }

    // 2. Split payment validation
    if (data.payment_mode === "SPLIT") {
      const cash = Number(data.cash_amount || 0);
      const upi = Number(data.upi_amount || 0);
      const card = Number(data.card_amount || 0);
      const credit = Number(data.credit_amount || 0);
      const sum = cash + upi + card + credit;
      const total = Number(data.total_amount || 0);

      if (Math.abs(sum - total) > 0.05) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Sum of split amounts (₹${sum.toFixed(2)}) must equal Total Amount (₹${total.toFixed(2)})`,
          path: ["cash_amount"],
        });
      }
    }
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
      cash_amount: 0,
      upi_amount: 0,
      card_amount: 0,
      credit_amount: 0,
      invoice_date: getTodayDateString(),
      ...defaultValues,
    },
  });

  const customerName = watch("customer_name") ?? "";
  const customerUuid = watch("customer_uuid") ?? "";
  const vehicleNumber = watch("vehicle_number") ?? "";

  const paymentMode = watch("payment_mode");
  const qty = watch("quantity_liters") ?? 0;
  const rate = watch("rate_per_liter") ?? 0;
  const totalAmount = watch("total_amount") ?? 0;

  const cashAmt = watch("cash_amount") ?? 0;
  const upiAmt = watch("upi_amount") ?? 0;
  const cardAmt = watch("card_amount") ?? 0;
  const creditAmt = watch("credit_amount") ?? 0;

  const allocatedTotal = Number((Number(cashAmt) + Number(upiAmt) + Number(cardAmt) + Number(creditAmt)).toFixed(2));
  const unallocatedAmount = Number((Number(totalAmount) - allocatedTotal).toFixed(2));

  const expectedAmount = Number((Number(qty) * Number(rate)).toFixed(2));
  const diff = Number(Math.abs(Number(totalAmount) - expectedAmount).toFixed(2));
  const isMismatch = Number(qty) > 0 && Number(rate) > 0 && diff > 0.05;

  const isVehicleFormatNonStandard = (() => {

    if (!vehicleNumber || !vehicleNumber.trim()) return false;
    const cleaned = vehicleNumber.replace(/[\s\-.]+/g, "").toUpperCase();
    const pattern = /^(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
    return !pattern.test(cleaned);
  })();


  function submitForm(
    data: VoucherFormData
  ) {

    // Empty string from the "None" option → no linked customer.
    const payload = {
      ...data,
      customer_uuid: data.customer_uuid || null,
    };

    if (!navigator.onLine) {
      const item = enqueueOfflineTransaction(
        "VOUCHER",
        "/v1/vouchers",
        payload,
        `Fuel Voucher #${payload.invoice_number}`
      );
      toast.warning(`📡 Offline Forecourt: Slip queued locally (${item.id.substring(0, 15)}...). Will auto-sync when connected!`);
      if (onSuccess) onSuccess();
      return;
    }

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

        <div>
          <VehicleAutocomplete
            value={vehicleNumber}
            error={errors.vehicle_number?.message}
            onChange={(number, vehicle) => {
              setValue("vehicle_number", number, {
                shouldValidate: true,
              });
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
          {isVehicleFormatNonStandard && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Non-standard vehicle format (will still save)
            </p>
          )}
        </div>

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

        {paymentMode === "SPLIT" && (
          <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                💳 Split Payment Breakdown
              </h4>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="text-slate-500 dark:text-slate-400">Total: ₹{Number(totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span className={Math.abs(unallocatedAmount) < 0.05 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
                  Allocated: ₹{allocatedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
                {Math.abs(unallocatedAmount) >= 0.05 && (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    ({unallocatedAmount > 0 ? `₹${unallocatedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} remaining` : `₹${Math.abs(unallocatedAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} over allocated`})
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FormInput
                type="number"
                step="0.01"
                label="Cash Portion (₹)"
                error={errors.cash_amount?.message}
                {...register("cash_amount")}
              />
              <FormInput
                type="number"
                step="0.01"
                label="UPI Portion (₹)"
                error={errors.upi_amount?.message}
                {...register("upi_amount")}
              />
              <FormInput
                type="number"
                step="0.01"
                label="Card Portion (₹)"
                error={errors.card_amount?.message}
                {...register("card_amount")}
              />
              <FormInput
                type="number"
                step="0.01"
                label="Credit Portion (₹)"
                error={errors.credit_amount?.message}
                {...register("credit_amount")}
              />
            </div>

            {unallocatedAmount > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Quick Fill:</span>
                <button
                  type="button"
                  onClick={() => setValue("cash_amount", Number((Number(cashAmt) + unallocatedAmount).toFixed(2)), { shouldValidate: true })}
                  className="px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-200 transition-colors"
                >
                  + Add ₹{unallocatedAmount} to Cash
                </button>
                <button
                  type="button"
                  onClick={() => setValue("upi_amount", Number((Number(upiAmt) + unallocatedAmount).toFixed(2)), { shouldValidate: true })}
                  className="px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-200 transition-colors"
                >
                  + Add ₹{unallocatedAmount} to UPI
                </button>
              </div>
            )}
          </div>
        )}


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
