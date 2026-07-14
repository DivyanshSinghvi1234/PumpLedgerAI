export type UserRole = "ADMIN" | "MANAGER" | "OPERATOR";

export interface User {
  uuid: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface CreateUserRequest {
  username: string;
  full_name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}
