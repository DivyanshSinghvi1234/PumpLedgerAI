import type { Pump } from "@/features/auth/services/pump";

export type UserRole = "ADMIN" | "MANAGER" | "OPERATOR";

export interface User {
  uuid: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  pump_access: Pump[];
}

export interface CreateUserRequest {
  username: string;
  full_name: string;
  password: string;
  role: UserRole;
  pump_uuids?: string[];
}

export interface UpdateUserRequest {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  pump_uuids?: string[];
}
