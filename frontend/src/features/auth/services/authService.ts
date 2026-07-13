import api from "@/api/client";

export type UserRole = "ADMIN" | "MANAGER" | "OPERATOR";

export interface CurrentUser {
  uuid: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

const USER_KEY = "user";

export async function login(
  credentials: LoginRequest
): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>(
    "/v1/auth/login",
    credentials
  );

  localStorage.setItem(
    "token",
    response.data.access_token
  );

  // Fetch the current user (incl. role) so the UI can gate by permission.
  const me = await api.get<CurrentUser>("/v1/auth/me");

  localStorage.setItem(
    USER_KEY,
    JSON.stringify(me.data)
  );

  return response.data;
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("token"));
}

export function getCurrentUser(): CurrentUser | null {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function getRole(): UserRole | null {
  return getCurrentUser()?.role ?? null;
}

export function hasRole(...roles: UserRole[]): boolean {
  const role = getRole();

  return role !== null && roles.includes(role);
}
