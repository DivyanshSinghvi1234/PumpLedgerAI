import { createBrowserRouter } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import LoginPage from "../features/auth/LoginPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import UploadPage from "../features/upload/UploadPage";
import OCRReviewPage from "../features/review/OCRReviewPage";
import VoucherListPage from "../features/vouchers/VoucherListPage";
import CustomerListPage from "../features/customers/CustomerListPage";
import VehicleListPage from "../features/vehicles/VehicleListPage";
import PaymentListPage from "../features/payments/PaymentListPage";
import CustomerLedgerPage from "../features/ledger/CustomerLedgerPage";
import ReportsPage from "../features/reports/ReportsPage";
import TallyExportPage from "../features/tally/TallyExportPage";
import InventoryPage from "../features/inventory/InventoryPage";
import DailySheetPage from "../features/daily-sheet/DailySheetPage";
import AuditLogPage from "../features/audit/AuditLogPage";
import UserManagementPage from "../features/users/UserManagementPage";
import AppErrorPage from "../components/common/AppErrorPage";
import AccessDeniedPage from "../components/auth/AccessDeniedPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginPage />,
    errorElement: <AppErrorPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
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
        element: <DashboardPage />,
      },
      {
        path: "upload",
        element: <UploadPage />,
      },
      {
        path: "review",
        element: <OCRReviewPage />,
      },
      {
        path: "vouchers",
        element: <VoucherListPage />,
      },
      {
        path: "access-denied",
        element: <AccessDeniedPage />,
      },

      /* ─── Manager + Admin ─── */
      {
        element: <ProtectedRoute allowedRoles={["ADMIN", "MANAGER"]} />,
        children: [
          {
            path: "customers",
            element: <CustomerListPage />,
          },
          {
            path: "customers/:customerUuid/ledger",
            element: <CustomerLedgerPage />,
          },
          {
            path: "vehicles",
            element: <VehicleListPage />,
          },
          {
            path: "payments",
            element: <PaymentListPage />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
          {
            path: "tally",
            element: <TallyExportPage />,
          },
          {
            path: "inventory",
            element: <InventoryPage />,
          },
          {
            path: "daily-sheet",
            element: <DailySheetPage />,
          },
          {
            path: "audit",
            element: <AuditLogPage />,
          },
        ],
      },

      /* ─── Admin only ─── */
      {
        element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
        children: [
          {
            path: "users",
            element: <UserManagementPage />,
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
    path: "*",
    element: <AppErrorPage />,
  },
]);

export default router;
