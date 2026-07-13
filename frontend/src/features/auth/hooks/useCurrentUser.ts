import {
  getCurrentUser,
  type CurrentUser,
  type UserRole,
} from "../services/authService";

export function useCurrentUser(): {
  user: CurrentUser | null;
  role: UserRole | null;
  hasRole(...roles: UserRole[]): boolean;
} {
  const user = getCurrentUser();

  return {
    user,
    role: user?.role ?? null,
    hasRole: (...roles: UserRole[]) =>
      user !== null && roles.includes(user.role),
  };
}
