import { useState } from "react";
import { ImageIcon } from "lucide-react";

import type { Voucher } from "@/types/voucher";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { VoucherPaymentStatusBadge } from "./VoucherStatusBadge";
import VoucherActions from "./VoucherActions";
import InvoiceImageDialog from "./InvoiceImageDialog";
import { invoiceImageUrl } from "../utils/invoiceImage";
import { formatCurrency } from "@/lib/utils";

interface Props {
  vouchers: Voucher[];
  canManage?: boolean;
  onEdit(voucher: Voucher): void;
  onDelete(voucher: Voucher): void;
}

export default function VoucherTable({
  vouchers,
  canManage = true,
  onEdit,
  onDelete,
}: Props) {

  const [imageVoucher, setImageVoucher] =
    useState<Voucher | null>(null);

  if (vouchers.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        No vouchers found.
      </div>
    );
  }

  return (
    <>
    <Table>

      <TableHeader>

        <TableRow>

          <TableHead>Invoice</TableHead>

          <TableHead>Customer</TableHead>

          <TableHead>Vehicle</TableHead>

          <TableHead>Fuel</TableHead>

          <TableHead>Amount</TableHead>

          <TableHead>Status</TableHead>

          <TableHead className="text-nowrap">Saved At</TableHead>

          <TableHead className="w-20">
            Actions
          </TableHead>

        </TableRow>

      </TableHeader>

      <TableBody>
        {vouchers.map((voucher) => (
          <TableRow key={voucher.uuid} className="border-hairline pl-row transition-colors">
            <TableCell className="text-sm font-medium text-ink">
              <div className="flex items-center gap-2">
                <span>{voucher.invoice_number}</span>
                {voucher.image_path && (
                  <button
                    type="button"
                    title="View invoice image"
                    onClick={() => setImageVoucher(voucher)}
                    className="text-ink-subtle hover:text-fuel-amber transition cursor-pointer"
                  >
                    <ImageIcon size={14} />
                  </button>
                )}
              </div>
            </TableCell>

            <TableCell className="text-sm text-ink-muted">
              {voucher.customer_name ?? "—"}
            </TableCell>

            <TableCell className="text-sm text-ink-muted">
              {voucher.vehicle_number ?? "—"}
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

            <TableCell className="text-sm font-semibold text-ink font-mono pl-numeric">
              <div className="flex flex-col">
                <span>{formatCurrency(voucher.total_amount)}</span>
                <span className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">
                  {voucher.payment_mode === "SPLIT" ? (
                    <span title={`Cash: ₹${voucher.cash_amount || 0}, UPI: ₹${voucher.upi_amount || 0}, Card: ₹${voucher.card_amount || 0}, Credit: ₹${voucher.credit_amount || 0}`}>
                      Split Mode
                    </span>
                  ) : (
                    voucher.payment_mode
                  )}
                </span>
                {voucher.is_amount_mismatch && (
                  <span className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider mt-0.5" title="Quantity * Rate does not match Total Amount">
                    ⚠️ Mismatch
                  </span>
                )}
              </div>
            </TableCell>

            <TableCell>
              <VoucherPaymentStatusBadge status={voucher.payment_status} />
            </TableCell>

            <TableCell className="text-xs text-ink-muted whitespace-nowrap">
              {voucher.created_at
                ? new Date(voucher.created_at).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—"}
            </TableCell>

            <TableCell>
              <div className="flex items-center gap-2">
                {voucher.customer_mobile && (
                  <a
                    href={`https://wa.me/${voucher.customer_mobile.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      `Dear Customer, here is your bill details:\nInvoice No: ${voucher.invoice_number}\nDate: ${voucher.invoice_date}\nAmount: ₹${voucher.total_amount}\nBalance Due: ₹${voucher.balance_due}\nThank you for your business!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg text-xs font-semibold border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 h-8 px-2.5 transition-colors cursor-pointer"
                    title="Send WhatsApp Billing Link"
                  >
                    WhatsApp
                  </a>
                )}
                <VoucherActions
                  voucherId={voucher.uuid}
                  canManage={canManage}
                  onEdit={() => onEdit(voucher)}
                  onDelete={() => onDelete(voucher)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>

    </Table>

    <InvoiceImageDialog
      open={Boolean(imageVoucher)}
      onOpenChange={(o) => !o && setImageVoucher(null)}
      imageUrl={invoiceImageUrl(imageVoucher?.image_path)}
      invoiceNumber={imageVoucher?.invoice_number}
    />
    </>
  );
}