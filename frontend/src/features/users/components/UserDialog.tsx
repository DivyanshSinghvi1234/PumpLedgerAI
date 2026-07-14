import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

import UserForm from "./UserForm";

import { useCreateUser } from "../hooks/useCreateUser";
import { useUpdateUser } from "../hooks/useUpdateUser";

import type { CreateUserRequest, UpdateUserRequest, User } from "../types/user";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  user?: User;
}

export default function UserDialog({
  open,
  onOpenChange,
  user,
}: Props) {
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const loading =
    createMutation.isPending || updateMutation.isPending;

  async function handleCreate(data: CreateUserRequest) {
    try {
      await createMutation.mutateAsync(data);
      onOpenChange(false);
    } catch {
      // Error surfaced by mutation toast
    }
  }

  async function handleUpdate(data: UpdateUserRequest) {
    if (!user) return;
    try {
      await updateMutation.mutateAsync({ uuid: user.uuid, data });
      onOpenChange(false);
    } catch {
      // Error surfaced by mutation toast
    }
  }

  useEffect(() => {
    if (!open) {
      createMutation.reset();
      updateMutation.reset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card p-6 shadow-xl">
        <DialogTitle className="mb-6 text-xl font-semibold">
          {user ? (
            <>
              Edit User —{" "}
              <span className="text-fuel-amber">{user.username}</span>
            </>
          ) : (
            "Create User"
          )}
        </DialogTitle>

        {user ? (
          <UserForm
            mode="edit"
            loading={loading}
            defaultValues={{
              full_name: user.full_name,
              role: user.role,
              pump_uuids: user.pump_access?.map((p) => p.uuid) ?? [],
            }}
            onCancel={() => onOpenChange(false)}
            onSubmit={(data) =>
              handleUpdate(data as UpdateUserRequest)
            }
          />
        ) : (
          <UserForm
            mode="create"
            loading={loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={(data) => handleCreate(data as CreateUserRequest)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
