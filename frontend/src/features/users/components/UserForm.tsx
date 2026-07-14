import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";

import type { UserRole } from "../types/user";
import { usePumpList } from "../hooks/usePumpList";

const createSchema = z
  .object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    full_name: z.string().min(1, "Full name is required"),
    role: z.enum(["ADMIN", "MANAGER", "OPERATOR"]),
    pump_uuids: z.array(z.string()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.role === "OPERATOR") {
      if (!data.pump_uuids || data.pump_uuids.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Employees must be assigned exactly 1 filling station",
          path: ["pump_uuids"],
        });
      }
    } else if (data.role === "MANAGER") {
      if (!data.pump_uuids || data.pump_uuids.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Managers must be assigned at least 1 filling station",
          path: ["pump_uuids"],
        });
      }
    }
  });

const editSchema = z
  .object({
    full_name: z.string().min(1, "Full name is required"),
    role: z.enum(["ADMIN", "MANAGER", "OPERATOR"]),
    pump_uuids: z.array(z.string()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.role === "OPERATOR") {
      if (!data.pump_uuids || data.pump_uuids.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Employees must be assigned exactly 1 filling station",
          path: ["pump_uuids"],
        });
      }
    } else if (data.role === "MANAGER") {
      if (!data.pump_uuids || data.pump_uuids.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Managers must be assigned at least 1 filling station",
          path: ["pump_uuids"],
        });
      }
    }
  });

type FormValues = {
  username?: string;
  password?: string;
  full_name: string;
  role: UserRole;
  pump_uuids?: string[];
};

interface BaseProps {
  loading?: boolean;
  onCancel?(): void;
}

interface CreateProps extends BaseProps {
  mode: "create";
  defaultValues?: Partial<FormValues>;
  onSubmit(data: z.input<typeof createSchema>): void | Promise<void>;
}

interface EditProps extends BaseProps {
  mode: "edit";
  defaultValues?: Partial<FormValues>;
  onSubmit(data: z.input<typeof editSchema>): void | Promise<void>;
}

type Props = CreateProps | EditProps;

export default function UserForm(props: Props) {
  const { mode, loading = false, onCancel } = props;
  const [showPassword, setShowPassword] = useState(false);

  const { data: pumps = [], isLoading: isLoadingPumps } = usePumpList();

  const isCreate = mode === "create";
  const schema = isCreate ? createSchema : editSchema;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      role: "OPERATOR" as UserRole,
      pump_uuids: [],
      ...(isCreate ? { username: "", password: "" } : {}),
      ...(props.defaultValues ?? {}),
    },
  });

  const selectedRole = watch("role");
  const selectedPumps = watch("pump_uuids") || [];

  const handlePumpToggle = (pumpUuid: string) => {
    let newSelection = [...selectedPumps];
    if (selectedRole === "OPERATOR") {
      // OPERATOR gets exactly 1 pump
      newSelection = [pumpUuid];
    } else {
      if (newSelection.includes(pumpUuid)) {
        newSelection = newSelection.filter((id) => id !== pumpUuid);
      } else {
        newSelection.push(pumpUuid);
      }
    }
    setValue("pump_uuids", newSelection, { shouldValidate: true });
  };

  return (
    <form
      onSubmit={handleSubmit((data: Record<string, unknown>) => {
        (props as CreateProps).onSubmit(data as never);
      })}
      className="space-y-5"
    >
      {isCreate && (
        <>
          <FormInput
            label="Username"
            required
            error={errors.username?.message}
            placeholder="e.g. ramesh"
            {...register("username")}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Password
              <span className="ml-1 text-error">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-hairline bg-surface-2 px-4 py-3 pr-12 text-sm text-ink outline-none transition placeholder:text-ink-tertiary focus:border-fuel-amber/50 focus:ring-2 focus:ring-fuel-amber/20"
                placeholder="Min 6 characters"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password?.message && (
              <p className="text-xs font-medium text-error">
                {errors.password.message}
              </p>
            )}
          </div>
        </>
      )}

      <FormInput
        label="Full Name"
        required
        error={errors.full_name?.message}
        placeholder="e.g. Ramesh Kumar"
        {...register("full_name")}
      />

      <FormSelect
        label="Role"
        options={[
          { value: "OPERATOR", label: "Employee" },
          { value: "MANAGER", label: "Manager" },
          { value: "ADMIN", label: "Admin" },
        ]}
        {...register("role")}
      />

      {selectedRole !== "ADMIN" && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Filling Station Access
            <span className="ml-1 text-error">*</span>
          </label>
          {isLoadingPumps ? (
            <p className="text-xs text-ink-muted">Loading pumps...</p>
          ) : pumps.length === 0 ? (
            <p className="text-xs text-error font-medium">No filling stations found in system.</p>
          ) : (
            <div className="space-y-2 bg-surface-2 rounded-xl p-3 border border-hairline max-h-48 overflow-y-auto">
              {pumps.map((pump) => {
                const isChecked = selectedPumps.includes(pump.uuid);
                return (
                  <label
                    key={pump.uuid}
                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-3/50 cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handlePumpToggle(pump.uuid)}
                      className="rounded border-hairline text-fuel-amber focus:ring-fuel-amber"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-ink">
                        {pump.name}
                      </span>
                      <span className="text-[10px] text-ink-tertiary uppercase font-mono">
                        Code: {pump.code}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          {errors.pump_uuids?.message && (
            <p className="text-xs font-medium text-error">
              {errors.pump_uuids.message}
            </p>
          )}
        </div>
      )}

      {selectedRole === "ADMIN" && (
        <div className="rounded-xl bg-fuel-amber/5 border border-fuel-amber/15 px-4 py-3 text-xs font-medium text-fuel-amber flex items-start gap-2.5">
          <span className="mt-0.5 flex h-2 w-2 rounded-full bg-fuel-amber shrink-0" />
          <span>Administrators automatically have access to all filling stations.</span>
        </div>
      )}

      <FormActions
        loading={loading}
        onCancel={onCancel}
        submitLabel={isCreate ? "Create User" : "Save Changes"}
      />
    </form>
  );
}
