import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";

import type { CreateVehicleRequest } from "../types/vehicle";

const vehicleSchema = z.object({
  customer_uuid: z
    .string()
    .min(1, "Customer is required"),

  customer_name: z.string().optional(),

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
  lockCustomer = false,
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
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),

    defaultValues: {
      customer_uuid: "",
      customer_name: "",
      vehicle_number: "",
      vehicle_type: "",
      ...defaultValues,
    },
  });

  const customerName = watch("customer_name") ?? "";
  const customerUuid = watch("customer_uuid") ?? "";

  function submitForm(
    data: VehicleFormData
  ) {
    return onSubmit({
      customer_uuid: data.customer_uuid,
      vehicle_number: data.vehicle_number,
      vehicle_type: data.vehicle_type || null,
    });
  }

  return (
    <form
      onSubmit={handleSubmit(submitForm)}
      className="space-y-6"
    >

      <div className="grid grid-cols-1 gap-4">

        <CustomerAutocomplete
          value={customerName}
          customerUuid={customerUuid || null}
          disabled={lockCustomer}
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
