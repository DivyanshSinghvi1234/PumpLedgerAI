import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormTextarea from "@/components/forms/FormTextarea";

import type {
  CreateCustomerRequest,
} from "../types/customer";

const customerSchema = z.object({
  customer_code: z.string().optional(),

  name: z
    .string()
    .min(2, "Customer name must be at least 2 characters"),

  mobile: z.string().optional(),

  email: z
    .string()
    .email("Invalid email")
    .optional()
    .or(z.literal("")),

  gst_number: z.string().optional(),

  address: z.string().optional(),

  city: z.string().optional(),

  state: z.string().optional(),

  pincode: z.string().optional(),

  credit_limit: z.coerce.number(),

  opening_balance: z.coerce.number(),

  remarks: z.string().optional(),
});

type CustomerFormData =
  z.output<typeof customerSchema>;

type CustomerFormInput =
  z.input<typeof customerSchema>;

interface Props {
  defaultValues?: Partial<CustomerFormData>;

  loading?: boolean;

  onCancel?(): void;

  onSubmit(
    data: CreateCustomerRequest
  ): void | Promise<void>;
}

export default function CustomerForm({
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
    CustomerFormInput,
    unknown,
    CustomerFormData
  >({
    resolver: zodResolver(
      customerSchema
    ),

    defaultValues: {
      credit_limit: 0,

      opening_balance: 0,

      ...defaultValues,
    },
  });

  function submitForm(
    data: CustomerFormData
  ) {
    return onSubmit(data);
  }

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <FormInput
          label="Customer Code"
          error={errors.customer_code?.message}
          {...register("customer_code")}
        />

        <FormInput
          label="Customer Name"
          required
          error={errors.name?.message}
          {...register("name")}
        />

        <FormInput
          label="Mobile"
          error={errors.mobile?.message}
          {...register("mobile")}
        />

        <FormInput
          label="Email"
          error={errors.email?.message}
          {...register("email")}
        />

        <FormInput
          label="GST Number"
          error={errors.gst_number?.message}
          {...register("gst_number")}
        />

        <FormInput
          label="City"
          error={errors.city?.message}
          {...register("city")}
        />

        <FormInput
          label="State"
          error={errors.state?.message}
          {...register("state")}
        />

        <FormInput
          label="Pincode"
          error={errors.pincode?.message}
          {...register("pincode")}
        />

        <FormInput
          type="number"
          label="Credit Limit"
          error={
            errors.credit_limit?.message
          }
          {...register("credit_limit")}
        />

        <FormInput
          type="number"
          label="Opening Balance"
          error={
            errors.opening_balance?.message
          }
          {...register(
            "opening_balance"
          )}
        />

      </div>

      <FormTextarea
        label="Address"
        rows={3}
        error={errors.address?.message}
        {...register("address")}
      />

      <FormTextarea
        label="Remarks"
        rows={4}
        error={errors.remarks?.message}
        {...register("remarks")}
      />

      <FormActions
        loading={loading}
        onCancel={onCancel}
        submitLabel="Save Customer"
      />

    </form>
  );
}