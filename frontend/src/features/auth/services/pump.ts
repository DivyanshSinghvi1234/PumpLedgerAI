export interface Pump {
  uuid: string;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
}

const ACTIVE_PUMP_KEY = "active_pump_uuid";

export function getActivePumpUuid(): string | null {
  return localStorage.getItem(ACTIVE_PUMP_KEY);
}

export function setActivePumpUuid(uuid: string): void {
  localStorage.setItem(ACTIVE_PUMP_KEY, uuid);
}

export function clearActivePumpUuid(): void {
  localStorage.removeItem(ACTIVE_PUMP_KEY);
}
