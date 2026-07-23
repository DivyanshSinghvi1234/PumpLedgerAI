import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import AppErrorPage from "../components/common/AppErrorPage";
import LoadingState from "../components/common/LoadingState";

// Code-split page components for fast section & tab switching
const LoginPage = lazy(() => import("../features/auth/LoginPage"));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage"));
const UploadPage = lazy(() => import("../features/upload/UploadPage"));
const OCRReviewPage = lazy(() => import("../features/review/OCRReviewPage"));
const VoucherListPage = lazy(() => import("../features/vouchers/VoucherListPage"));
const CustomerListPage = lazy(() => import("../features/customers/CustomerListPage"));
const VehicleListPage = lazy(() => import("../features/vehicles/VehicleListPage"));
const VehicleLedgerPage = lazy(() => import("../features/vehicles/VehicleLedgerPage"));
const PaymentListPage = lazy(() => import("../features/payments/PaymentListPage"));
const CustomerLedgerPage = lazy(() => import("../features/ledger/CustomerLedgerPage"));
const CustomerStatementPrint = lazy(() => import("../features/ledger/CustomerStatementPrint"));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage"));
const TallyExportPage = lazy(() => import("../features/tally/TallyExportPage"));
const InventoryPage = lazy(() => import("../features/inventory/InventoryPage"));
const IncomePage = lazy(() => import("../features/income/IncomePage"));
const RegisterPage = lazy(() => import("../features/income/RegisterPage"));
const AuditLogPage = lazy(() => import("../features/audit/AuditLogPage"));
const UserManagementPage = lazy(() => import("../features/users/UserManagementPage"));
const AccessDeniedPage = lazy(() => import("../components/auth/AccessDeniedPage"));
const ProtectedRoute = lazy(() => import("../components/auth/ProtectedRoute"));
const RatingPage = lazy(() => import("../components/public/RatingPage"));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingState />}>{children}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
    errorElement: <AppErrorPage />,
  },
  {
    path: "/login",
    element: <SuspenseWrapper><LoginPage /></SuspenseWrapper>,
    errorElement: <AppErrorPage />,
  },
  {
    path: "/dashboard",
    element: <AppLayout />,
    errorElement: <AppErrorPage />,
    children: [
      /* ─── Open to ALL authenticated roles ─── */
      {
        index: true,
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: "upload",
        element: <SuspenseWrapper><UploadPage /></SuspenseWrapper>,
      },
      {
        path: "review",
        element: <SuspenseWrapper><OCRReviewPage /></SuspenseWrapper>,
      },
      {
        path: "vouchers",
        element: <SuspenseWrapper><VoucherListPage /></SuspenseWrapper>,
      },
      {
        path: "access-denied",
        element: <SuspenseWrapper><AccessDeniedPage /></SuspenseWrapper>,
      },

      /* ─── Manager + Admin ─── */
      {
        element: <ProtectedRoute allowedRoles={["ADMIN", "MANAGER"]} />,
        children: [
          {
            path: "customers",
            element: <SuspenseWrapper><CustomerListPage /></SuspenseWrapper>,
          },
          {
            path: "customers/:customerUuid/ledger",
            element: <SuspenseWrapper><CustomerLedgerPage /></SuspenseWrapper>,
          },
          {
            path: "vehicles",
            element: <SuspenseWrapper><VehicleListPage /></SuspenseWrapper>,
          },
          {
            path: "vehicles/:vehicleUuid/ledger",
            element: <SuspenseWrapper><VehicleLedgerPage /></SuspenseWrapper>,
          },
          {
            path: "payments",
            element: <SuspenseWrapper><PaymentListPage /></SuspenseWrapper>,
          },
          {
            path: "reports",
            element: <SuspenseWrapper><ReportsPage /></SuspenseWrapper>,
          },
          {
            path: "tally",
            element: <SuspenseWrapper><TallyExportPage /></SuspenseWrapper>,
          },
          {
            path: "inventory",
            element: <SuspenseWrapper><InventoryPage /></SuspenseWrapper>,
          },
          {
            path: "income",
            element: <SuspenseWrapper><IncomePage /></SuspenseWrapper>,
          },
          {
            path: "register",
            element: <SuspenseWrapper><RegisterPage /></SuspenseWrapper>,
          },
          {
            path: "audit",
            element: <SuspenseWrapper><AuditLogPage /></SuspenseWrapper>,
          },
        ],
      },

      /* ─── Admin only ─── */
      {
        element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
        children: [
          {
            path: "users",
            element: <SuspenseWrapper><UserManagementPage /></SuspenseWrapper>,
          },
        ],
      },

      {
        path: "*",
        element: (
          <div style={{ padding: 16 }}>
            <h2 style={{ margin: 0 }}>Page not found</h2>
            <p style={{ marginTop: 8, color: "rgba(0,0,0,.7)" }}>
              The page you requested doesn't exist.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    path: "/statement/:customerUuid",
    element: <ProtectedRoute allowedRoles={["ADMIN", "MANAGER"]} />,
    children: [
      {
        path: "",
        element: <SuspenseWrapper><CustomerStatementPrint /></SuspenseWrapper>,
      },
    ],
  },
  {
    path: "/public/rate/:token",
    element: <SuspenseWrapper><RatingPage /></SuspenseWrapper>,
    errorElement: <AppErrorPage />,
  },
  {
    path: "*",
    element: <AppErrorPage />,
  },
]);

export default router;
