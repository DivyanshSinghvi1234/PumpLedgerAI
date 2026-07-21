import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";
import { isAuthenticated } from "../features/auth/services/authService";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="relative flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {/* Subtle dot-grid background */}
          <div className="absolute inset-0 dot-grid pointer-events-none" />
          {/* Warm glow at top (light mode only) */}
          <div className="absolute top-0 left-0 right-0 h-48 fuel-glow pointer-events-none dark:hidden" />

          <div className="relative z-10 animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
