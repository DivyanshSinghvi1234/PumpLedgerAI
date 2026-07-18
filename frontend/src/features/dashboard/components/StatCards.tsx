import {
  FileText,
  Users,
  Truck,
  Banknote,
  TrendingUp,
} from "lucide-react";

import { formatCurrency } from "@/lib/utils";

import type { DashboardSummary } from "../types/dashboard";

import StatCard from "./StatCard";

interface Props {
  summary: DashboardSummary;
}

export default function StatCards({
  summary,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
      <StatCard
        title="Today's Sales"
        value={formatCurrency(summary.today_sales)}
        icon={TrendingUp}
        accent="text-success"
        iconBg="bg-success/10"
      />

      <StatCard
        title="Today's Vouchers"
        value={summary.today_vouchers}
        icon={FileText}
        accent="text-fuel-amber"
        iconBg="bg-fuel-amber/10"
      />

      <StatCard
        title="Total Sales"
        value={formatCurrency(summary.total_sales)}
        icon={Banknote}
        accent="text-fuel-gold"
        iconBg="bg-fuel-gold/10"
      />

      <StatCard
        title="Total Vouchers"
        value={summary.total_vouchers}
        icon={FileText}
        accent="text-petrol-blue"
        iconBg="bg-petrol-blue/10"
      />


      <StatCard
        title="Customers"
        value={summary.total_customers}
        icon={Users}
        accent="text-info"
        iconBg="bg-info/10"
      />

      <StatCard
        title="Vehicles"
        value={summary.total_vehicles}
        icon={Truck}
        accent="text-fuel-orange"
        iconBg="bg-fuel-orange/10"
      />
    </div>
  );
}
