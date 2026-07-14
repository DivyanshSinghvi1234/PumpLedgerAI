import { useQuery } from "@tanstack/react-query";

import userService from "../services/userService";

export function useUserList() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => userService.getUsers(),
    placeholderData: (previous) => previous,
  });
}
