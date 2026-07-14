import { Navigate, Outlet } from "react-router-dom";
import {
  isAuthenticated,
  hasRole,
  type UserRole,
} from "@/features/auth/services/authService";

interface ProtectedRouteProps {
  /** Roles allowed to access child routes. If empty, any authenticated user is allowed. */
  allowedRoles?: UserRole[];
}

/**
 * Route-level guard.
 *
 * - Not authenticated → redirect to `/login`
 * - Authenticated but wrong role → redirect to `/dashboard/access-denied`
 * - OK → render `<Outlet />`
 */
export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return <Navigate to="/dashboard/access-denied" replace />;
  }

  return <Outlet />;
}
