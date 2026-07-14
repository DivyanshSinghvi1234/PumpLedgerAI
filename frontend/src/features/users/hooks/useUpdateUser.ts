import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractApiError } from "@/api/client";
import userService from "../services/userService";

import type { UpdateUserRequest } from "../types/user";

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uuid,
      data,
    }: {
      uuid: string;
      data: UpdateUserRequest;
    }) => userService.updateUser(uuid, data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated.");
    },

    onError: (err) => {
      toast.error(extractApiError(err, "Unable to update user."));
    },
  });
}
