import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatCurrency } from "@/lib/utils";

import type { Voucher } from "@/types/voucher";

import VoucherStatusBadge from "@/features/vouchers/components/VoucherStatusBadge";

interface Props {
  vouchers: Voucher[];
}

export default function RecentVouchers({
  vouchers,
}: Props) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-hairline">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            Recent Vouchers
          </h3>
          <p className="text-xs text-ink-subtle mt-0.5">Latest fuel transactions</p>
        </div>

        <Link
          to="/dashboard/vouchers"
          className="flex items-center gap-1.5 rounded-lg bg-surface-3 px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-4 transition"
        >
          View all
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="p-0">
        {vouchers.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-subtle">
            No vouchers yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-hairline hover:bg-transparent">
                <TableHead className="text-ink-subtle text-[11px] font-semibold uppercase tracking-wider">Invoice</TableHead>

                <TableHead className="text-ink-subtle text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>

                <TableHead className="text-ink-subtle text-[11px] font-semibold uppercase tracking-wider">Fuel</TableHead>

                <TableHead className="text-ink-subtle text-[11px] font-semibold uppercase tracking-wider">Amount</TableHead>

                <TableHead className="text-ink-subtle text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {vouchers.map((voucher) => (
                <TableRow key={voucher.uuid} className="border-hairline table-row-hover transition-colors">
                  <TableCell className="text-sm font-medium text-ink">
                    {voucher.invoice_number}
                  </TableCell>

                  <TableCell className="text-sm text-ink-muted">
                    {voucher.customer_name ?? "—"}
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        voucher.fuel_type === "PETROL" ? "bg-petrol-blue" :
                        voucher.fuel_type === "DIESEL" ? "bg-diesel-amber" :
                        "bg-lube-emerald"
                      }`} />
                      {voucher.fuel_type}
                    </span>
                  </TableCell>

                  <TableCell className="text-sm font-semibold text-ink font-mono">
                    {formatCurrency(voucher.total_amount)}
                  </TableCell>

                  <TableCell>
                    <VoucherStatusBadge
                      status={voucher.verification_status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
