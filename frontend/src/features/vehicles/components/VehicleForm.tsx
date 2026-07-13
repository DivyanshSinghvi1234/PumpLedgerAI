import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";

import type { CreateVehicleRequest } from "../types/vehicle";

const vehicleSchema = z.object({
  customer_uuid: z
    .string()
    .min(1, "Customer is required"),

  vehicle_number: z
    .string()
    .min(4, "Vehicle number must be at least 4 characters"),

  vehicle_type: z.string().optional(),
});

type VehicleFormData =
  z.output<typeof vehicleSchema>;

interface CustomerOption {
  label: string;
  value: string;
}

interface Props {
  defaultValues?: Partial<VehicleFormData>;

  customerOptions: CustomerOption[];

  /** Customer cannot be reassigned on edit. */
  lockCustomer?: boolean;

  loading?: boolean;

  onCancel?(): void;

  onSubmit(
    data: CreateVehicleRequest
  ): void | Promise<void>;
}

export default function VehicleForm({
  defaultValues,
  customerOptions,
  lockCustomer = false,
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
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),

    defaultValues: {
      customer_uuid: "",
      vehicle_number: "",
      vehicle_type: "",
      ...defaultValues,
    },
  });

  function submitForm(
    data: VehicleFormData
  ) {
    return onSubmit(data);
  }

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-1 gap-4">

        <FormSelect
          label="Customer"
          disabled={lockCustomer}
          error={errors.customer_uuid?.message}
          options={[
            {
              label: "Select customer...",
              value: "",
            },
            ...customerOptions,
          ]}
          {...register("customer_uuid")}
        />

        <FormInput
          label="Vehicle Number"
          required
          error={errors.vehicle_number?.message}
          {...register("vehicle_number")}
        />

        <FormInput
          label="Vehicle Type"
          error={errors.vehicle_type?.message}
          {...register("vehicle_type")}
        />

      </div>

      <FormActions
        loading={loading}
        onCancel={onCancel}
        submitLabel="Save Vehicle"
      />

    </form>
  );
}
