import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import AppErrorPage from "../components/common/AppErrorPage";
import LoadingState from "../components/common/LoadingState";

const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageRefreshed = sessionStorage.getItem("chunk_retry_refreshed");
    try {
      const component = await componentImport();
      sessionStorage.removeItem("chunk_retry_refreshed");
      return component;
    } catch (error) {
      if (!pageRefreshed) {
        sessionStorage.setItem("chunk_retry_refreshed", "true");
        window.location.reload();
      }
      throw error;
    }
  });

const LoginPage = lazyWithRetry(() => import("../features/auth/LoginPage"));

// Core 5-page app
const UnifiedDailyRegisterPage = lazyWithRetry(
  () => import("../features/register/UnifiedDailyRegisterPage")
);
const SlipsHubPage = lazyWithRetry(() => import("../features/slips/SlipsHubPage"));
const OCRReviewPage = lazyWithRetry(() => import("../features/review/OCRReviewPage"));
const CustomersHubPage = lazyWithRetry(
  () => import("../features/customers/CustomersHubPage")
);
const InventoryPage = lazyWithRetry(() => import("../features/inventory/InventoryPage"));
const MoneyProfitHubPage = lazyWithRetry(
  () => import("../features/money/MoneyProfitHubPage")
);
const MoreToolsPage = lazyWithRetry(() => import("../features/settings/MoreToolsPage"));

// Detail & print views linked from within the 5 core pages
const CustomerLedgerPage = lazyWithRetry(
  () => import("../features/ledger/CustomerLedgerPage")
);
const CustomerStatementPrint = lazyWithRetry(
  () => import("../features/ledger/CustomerStatementPrint")
);
const VehicleLedgerPage = lazyWithRetry(
  () => import("../features/vehicles/VehicleLedgerPage")
);
const RegisterPage = lazyWithRetry(() => import("../features/income/RegisterPage"));

const AccessDeniedPage = lazyWithRetry(
  () => import("../components/auth/AccessDeniedPage")
);
const ProtectedRoute = lazyWithRetry(
  () => import("../components/auth/ProtectedRoute")
);
const RatingPage = lazyWithRetry(() => import("../components/public/RatingPage"));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<LoadingState />}>{children}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
    errorElement: <AppErrorPage />,
  },
  {
    path: "/login",
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
    errorElement: <AppErrorPage />,
  },
  {
    path: "/dashboard",
    element: <AppLayout />,
    errorElement: <AppErrorPage />,
    children: [
      /* ─── 1. Daily Register (Home) & 2. Slips / OCR (Open to all roles) ─── */
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <UnifiedDailyRegisterPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "slips",
        element: (
          <SuspenseWrapper>
            <SlipsHubPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "review",
        element: (
          <SuspenseWrapper>
            <OCRReviewPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: "access-denied",
        element: (
          <SuspenseWrapper>
            <AccessDeniedPage />
          </SuspenseWrapper>
        ),
      },

      /* ─── Legacy slip paths redirected cleanly ─── */
      { path: "upload", element: <Navigate to="/dashboard/slips" replace /> },
      { path: "quick-entry", element: <Navigate to="/dashboard/slips?tab=quick" replace /> },
      { path: "pos", element: <Navigate to="/dashboard/slips?tab=quick" replace /> },
      { path: "vouchers", element: <Navigate to="/dashboard/slips?tab=list" replace /> },

      /* ─── 3. Customers & Vehicles, 4. Inventory, 5. Money & Profit, Settings (Manager + Admin) ─── */
      {
        element: <ProtectedRoute allowedRoles={["ADMIN", "MANAGER"]} />,
        children: [
          {
            path: "customers",
            element: (
              <SuspenseWrapper>
                <CustomersHubPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "customers/:customerUuid/ledger",
            element: (
              <SuspenseWrapper>
                <CustomerLedgerPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "vehicles/:vehicleUuid/ledger",
            element: (
              <SuspenseWrapper>
                <VehicleLedgerPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "inventory",
            element: (
              <SuspenseWrapper>
                <InventoryPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "money",
            element: (
              <SuspenseWrapper>
                <MoneyProfitHubPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "settings",
            element: (
              <SuspenseWrapper>
                <MoreToolsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: "register-sheet",
            element: (
              <SuspenseWrapper>
                <RegisterPage />
              </SuspenseWrapper>
            ),
          },

          /* ─── Legacy overlapping routes redirected cleanly ─── */
          { path: "day-closing", element: <Navigate to="/dashboard" replace /> },
          { path: "close-day", element: <Navigate to="/dashboard" replace /> },
          { path: "shift-settlement", element: <Navigate to="/dashboard" replace /> },
          { path: "register", element: <Navigate to="/dashboard" replace /> },
          { path: "income", element: <Navigate to="/dashboard" replace /> },
          { path: "command-center", element: <Navigate to="/dashboard/money?tab=profit" replace /> },
          { path: "vehicles", element: <Navigate to="/dashboard/customers?tab=vehicles" replace /> },
          { path: "payments", element: <Navigate to="/dashboard/customers?tab=payments" replace /> },
          { path: "bank-accounts", element: <Navigate to="/dashboard/money" replace /> },
          { path: "reports", element: <Navigate to="/dashboard/money?tab=reports" replace /> },
          { path: "forecourt-twin", element: <Navigate to="/dashboard/inventory" replace /> },
          { path: "staff", element: <Navigate to="/dashboard/settings?tab=staff" replace /> },
          { path: "tally", element: <Navigate to="/dashboard/settings?tab=tally" replace /> },
          { path: "audit", element: <Navigate to="/dashboard/settings?tab=audit" replace /> },
        ],
      },

      /* ─── Admin only ─── */
      {
        element: <ProtectedRoute allowedRoles={["ADMIN"]} />,
        children: [
          { path: "users", element: <Navigate to="/dashboard/settings?tab=users" replace /> },
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
        element: (
          <SuspenseWrapper>
            <CustomerStatementPrint />
          </SuspenseWrapper>
        ),
      },
    ],
  },
  {
    path: "/public/rate/:token",
    element: (
      <SuspenseWrapper>
        <RatingPage />
      </SuspenseWrapper>
    ),
    errorElement: <AppErrorPage />,
  },
  {
    path: "*",
    element: <AppErrorPage />,
  },
]);

export default router;
