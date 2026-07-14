import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import FormActions from "@/components/forms/FormActions";
import FormInput from "@/components/forms/FormInput";
import FormSelect from "@/components/forms/FormSelect";

import type { UserRole } from "../types/user";

const createSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Full name is required"),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR"]),
});

const editSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR"]),
});

type FormValues = {
  username?: string;
  password?: string;
  full_name: string;
  role: UserRole;
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

  const isCreate = mode === "create";
  const schema = isCreate ? createSchema : editSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      role: "OPERATOR" as UserRole,
      ...(isCreate ? { username: "", password: "" } : {}),
      ...(props.defaultValues ?? {}),
    },
  });

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

      <FormActions
        loading={loading}
        onCancel={onCancel}
        submitLabel={isCreate ? "Create User" : "Save Changes"}
      />
    </form>
  );
}
