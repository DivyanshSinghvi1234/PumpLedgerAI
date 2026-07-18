import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import customerService from "@/features/customers/services/customerService";
import { extractApiError } from "@/api/client";

import type { CreateVehicleRequest } from "../types/vehicle";

const vehicleSchema = z
  .object({
    customer_uuid: z.string().optional(),

    customer_name: z.string().optional(),

    vehicle_number: z
      .string()
      .min(1, "Vehicle number is required")
      .max(20, "Vehicle number must be at most 20 characters"),

    vehicle_type: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.customer_uuid && data.customer_uuid.trim().length > 0) ||
      Boolean(data.customer_name && data.customer_name.trim().length > 0),
    {
      message: "Customer is required",
      path: ["customer_name"],
    }
  );

type VehicleFormData = z.output<typeof vehicleSchema>;

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

  onSubmit(data: CreateVehicleRequest): void | Promise<void>;
}

export default function VehicleForm({
  defaultValues,
  lockCustomer = false,
  loading = false,
  onCancel,
  onSubmit,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
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

  async function submitForm(data: VehicleFormData) {
    setSubmitting(true);
    try {
      let targetCustomerUuid = data.customer_uuid?.trim() || "";

      // If customer_uuid is empty but customer_name is entered, auto-link or auto-create customer.
      if (!targetCustomerUuid && data.customer_name?.trim()) {
        const nameToUse = data.customer_name.trim();

        const searchRes = await customerService.getCustomers({
          search: nameToUse,
          page: 1,
          page_size: 10,
        });

        const exactMatch = searchRes.items.find(
          (c) => c.name.trim().toLowerCase() === nameToUse.toLowerCase()
        );

        if (exactMatch) {
          targetCustomerUuid = exactMatch.uuid;
        } else {
          const newCust = await customerService.createCustomer({
            name: nameToUse,
          });
          targetCustomerUuid = newCust.uuid;
          toast.success(`Created new customer "${newCust.name}"`);
        }
      }

      if (!targetCustomerUuid) {
        toast.error("Customer is required");
        return;
      }

      await onSubmit({
        customer_uuid: targetCustomerUuid,
        vehicle_number: data.vehicle_number.trim(),
        vehicle_type: data.vehicle_type?.trim() || null,
      });
    } catch (err: any) {
      toast.error(extractApiError(err, "Failed to save vehicle"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <CustomerAutocomplete
          value={customerName}
          customerUuid={customerUuid || null}
          disabled={lockCustomer}
          error={
            errors.customer_name?.message ?? errors.customer_uuid?.message
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
        loading={loading || submitting}
        onCancel={onCancel}
        submitLabel="Save Vehicle"
      />
    </form>
  );
}
