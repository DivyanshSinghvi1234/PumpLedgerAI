import {
  getCurrentUser,
  type CurrentUser,
  type UserRole,
} from "../services/authService";
import { getActivePumpUuid, setActivePumpUuid, type Pump } from "../services/pump";

export function useCurrentUser(): {
  user: CurrentUser | null;
  role: UserRole | null;
  hasRole(...roles: UserRole[]): boolean;
  pumps: Pump[];
  activePump: Pump | null;
  switchPump(uuid: string): void;
} {
  const user = getCurrentUser();
  const pumps = user?.pump_access ?? [];
  const activeUuid = getActivePumpUuid();
  const activePump = pumps.find((p) => p.uuid === activeUuid) || null;

  function switchPump(uuid: string) {
    if (pumps.some((p) => p.uuid === uuid)) {
      setActivePumpUuid(uuid);
      // Force page reload to clear cache & reset state scoped to the new pump
      window.location.reload();
    }
  }

  return {
    user,
    role: user?.role ?? null,
    hasRole: (...roles: UserRole[]) =>
      user !== null && roles.includes(user.role),
    pumps,
    activePump,
    switchPump,
  };
}
