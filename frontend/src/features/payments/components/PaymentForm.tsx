import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import api from "@/api/client";
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
import { numberToIndianWords } from "@/lib/formatters";

import type {
  CreatePaymentRequest,
  PaymentMode,
} from "../types/payment";

interface CustomerOption {
  label: string;
  value: string;
}

import BankAccountSelect from "@/components/common/BankAccountSelect";
import UpiAccountSelect from "@/components/common/UpiAccountSelect";

// Enum values mirror the backend (app/core/enums.py).
const PAYMENT_OPTIONS: { label: string; value: PaymentMode }[] = [
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
  { label: "Card", value: "CARD" },
  { label: "Bank Transfer", value: "BANK" },
  { label: "Split (Cash + Bank/UPI)", value: "SPLIT" },
  { label: "Credit", value: "CREDIT" },
];

const paymentSchema = z.object({
  customer_uuid: z
    .string()
    .min(1, "Customer is required"),

  customer_name: z.string().optional(),

  // Optional: scope FIFO allocation to one vehicle's vouchers.
  vehicle_uuid: z.string().optional(),

  vehicle_number: z.string().optional(),

  amount: z.coerce
    .number()
    .positive("Amount must be greater than 0"),

  payment_mode: z.enum(["CASH", "UPI", "CARD", "BANK", "CREDIT", "SPLIT"]),

  cash_amount: z.coerce.number().min(0).optional(),

  bank_amount: z.coerce.number().min(0).optional(),

  bank_account_uuid: z.string().optional(),

  payment_date: z
    .string()
    .min(1, "Payment date is required"),

  reference_number: z.string().optional(),

  remarks: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.payment_mode === "SPLIT") {
    const c = val.cash_amount ?? 0;
    const b = val.bank_amount ?? 0;
    if (Math.abs(c + b - val.amount) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bank_amount"],
        message: "Cash + Bank/UPI amount must equal Total Amount.",
      });
    }
  }
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
  const vehicleNumber = watch("vehicle_number") ?? "";
  const paymentMode = watch("payment_mode");
  const totalAmt = Number(watch("amount") ?? 0);
  const cashPart = watch("cash_amount");
  const refNum = watch("reference_number") ?? "";
  const [selectedUpiUuid, setSelectedUpiUuid] = useState("");
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [dupRefWarning, setDupRefWarning] = useState<string | null>(null);

  // Fetch customer's live outstanding balance for Overpayment warning
  useEffect(() => {
    if (!customerUuid) {
      setCustomerBalance(null);
      return;
    }
    api.get(`/v1/customers/${customerUuid}`)
      .then((res) => setCustomerBalance(Number(res.data?.outstanding_balance ?? 0)))
      .catch(() => setCustomerBalance(null));
  }, [customerUuid]);

  // Auto-Fill Remainder in SPLIT mode: Bank/UPI = Total - Cash
  useEffect(() => {
    if (paymentMode === "SPLIT" && totalAmt > 0 && cashPart !== undefined && cashPart !== null) {
      const rem = Math.max(0, totalAmt - Number(cashPart || 0));
      setValue("bank_amount", Number(rem.toFixed(2)));
    }
  }, [paymentMode, totalAmt, cashPart]);

  // Real-Time Duplicate UTR / Reference Number Guard
  useEffect(() => {
    const trimmed = refNum.trim();
    if (trimmed.length < 4) {
      setDupRefWarning(null);
      return;
    }
    const t = setTimeout(() => {
      api.get("/pipeline/check-duplicate", { params: { reference_number: trimmed } })
        .then((res) => {
          if (res.data?.duplicate_reference) {
            setDupRefWarning(`Duplicate UTR/Ref # detected: ${(res.data.matches || []).join(", ")}`);
          } else {
            setDupRefWarning(null);
          }
        })
        .catch(() => setDupRefWarning(null));
    }, 350);
    return () => clearTimeout(t);
  }, [refNum]);

  function submitForm(
    data: PaymentFormData
  ) {
    return onSubmit({
      customer_uuid: data.customer_uuid,
      amount: data.amount,
      payment_mode: data.payment_mode,
      cash_amount: data.payment_mode === "SPLIT" ? (data.cash_amount ?? 0) : null,
      bank_amount: data.payment_mode === "SPLIT" ? (data.bank_amount ?? 0) : null,
      bank_account_uuid: data.bank_account_uuid || null,
      payment_date: data.payment_date,
      reference_number: data.reference_number,
      remarks: data.remarks,
      vehicle_uuid: data.vehicle_uuid || null,
      vehicle_number: data.vehicle_number || null,
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

        <div className="col-span-1 sm:col-span-2">
          <VehicleAutocomplete
            label="Vehicle (optional — scopes allocation)"
            value={vehicleNumber}
            error={errors.vehicle_uuid?.message}
            onChange={(number, vehicle) => {
              setValue("vehicle_number", number, {
                shouldValidate: true,
              });
              setValue("vehicle_uuid", vehicle?.uuid ?? "", {
                shouldValidate: true,
              });
              // Picking a vehicle pins the payment to its owning customer so
              // the FIFO allocation stays consistent.
              if (vehicle) {
                setValue("customer_name", vehicle.customer_name, {
                  shouldValidate: true,
                });
                setValue("customer_uuid", vehicle.customer_uuid, {
                  shouldValidate: true,
                });
              }
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
        {totalAmt > 0 && (
          <div className="col-span-1 sm:col-span-2 -mt-3 text-[11px] text-ink-muted italic">
            {numberToIndianWords(totalAmt)}
          </div>
        )}

        {customerBalance !== null && totalAmt > customerBalance && (
          <div className="col-span-1 sm:col-span-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <strong>Overpayment — will stay as Advance:</strong> Customer due is ₹{customerBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}, so ₹{(totalAmt - customerBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })} will be recorded as unallocated advance.
          </div>
        )}

        {dupRefWarning && (
          <div className="col-span-1 sm:col-span-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300 font-semibold">
            {dupRefWarning}
          </div>
        )}

        <FormSelect
          label="Payment Mode"
          options={PAYMENT_OPTIONS}
          error={errors.payment_mode?.message}
          {...register("payment_mode")}
        />

        {(paymentMode === "SPLIT") && (
          <>
            <FormInput
              type="number"
              step="0.01"
              label="Cash Part (₹)"
              error={errors.cash_amount?.message}
              {...register("cash_amount")}
            />
            <FormInput
              type="number"
              step="0.01"
              label="Bank / UPI Part (₹)"
              error={errors.bank_amount?.message}
              {...register("bank_amount")}
            />
          </>
        )}

        {(paymentMode === "UPI" || paymentMode === "SPLIT") && (
          <div className="col-span-1 sm:col-span-2">
            <UpiAccountSelect
              value={selectedUpiUuid}
              onChange={(upiUuid, linkedBankUuid, acc) => {
                setSelectedUpiUuid(upiUuid);
                if (linkedBankUuid) {
                  setValue("bank_account_uuid", linkedBankUuid, { shouldValidate: true });
                }
                if (acc && !watch("reference_number")) {
                  setValue("reference_number", `${acc.provider}:${acc.name}`);
                }
              }}
            />
          </div>
        )}

        {(paymentMode === "UPI" || paymentMode === "CARD" || paymentMode === "BANK" || paymentMode === "SPLIT") && (
          <div className="col-span-1 sm:col-span-2">
            <BankAccountSelect
              value={watch("bank_account_uuid")}
              onChange={(uuid) => setValue("bank_account_uuid", uuid, { shouldValidate: true })}
            />
          </div>
        )}

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
