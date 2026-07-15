import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Coins,
  FileText,
  Receipt,
  PiggyBank,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import voucherService from "@/features/vouchers/services/voucherService";



function formatCurrencyIN(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface SheetPreviewProps {
  createDate: string;
  periodStart: string;
  periodEnd: string;
  sheetAlreadyExists: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
  createError: string | null;
}

export default function SheetPreview({
  createDate,
  periodStart,
  periodEnd,
  sheetAlreadyExists,
  onGenerate,
  isGenerating,
  createError: _createError,
}: SheetPreviewProps) {
  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["previewReadings", createDate],
    queryFn: () => inventoryService.getBulkReadingsForm(createDate),
  });

  const voucherParams = {
    from_datetime: new Date(periodStart).toISOString(),
    to_datetime: new Date(periodEnd).toISOString(),
    page_size: 100,
  };

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["previewPayments", createDate],
    queryFn: () =>
      paymentService.getPayments({
        payment_date: createDate,
        page_size: 100,
      }),
  });

  const { data: dailyVouchers, isLoading: vouchersLoading } = useQuery({
    queryKey: ["previewVouchers", createDate, voucherParams],
    queryFn: () => voucherService.getVouchers(voucherParams),
  });

  const totalLitersSold = useMemo(() => {
    if (!salesForm?.items) return 0;
    return salesForm.items.reduce((sum, item) => {
      const opening = item.opening_reading || 0;
      const closing = item.closing_reading !== null ? item.closing_reading : null;
      return closing !== null && closing >= opening ? sum + (closing - opening) : sum;
    }, 0);
  }, [salesForm]);

  const totalInvoiceSales = useMemo(
    () => dailyVouchers?.items?.reduce((sum, v) => sum + Number(v.total_amount), 0) ?? 0,
    [dailyVouchers]
  );

  const totalPaymentsCollected = useMemo(
    () => dailyPayments?.items?.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0,
    [dailyPayments]
  );

  const totalCashCollected = useMemo(() => {
    const cashPayments =
      dailyPayments?.items?.filter((p) => p.payment_mode === "CASH").reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
    const cashVouchers =
      dailyVouchers?.items?.filter((v) => v.payment_mode === "CASH").reduce((sum, v) => sum + Number(v.total_amount), 0) ?? 0;
    return cashPayments + cashVouchers;
  }, [dailyPayments, dailyVouchers]);

  const isLoading = salesFormLoading || paymentsLoading || vouchersLoading;

  return (
    <div className="space-y-6 pt-4 border-t border-hairline">
      {/* Summary preview bar header */}
      <Card className="glass border-hairline p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
            <ClipboardList size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Live Sheet Preview</h3>
            <p className="text-xs text-ink-subtle">
              Real-time snapshot preview for the selected accounting timeline below.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          {sheetAlreadyExists ? (
            <div className="flex items-center gap-2 text-xs text-fuel-amber font-semibold bg-fuel-amber/5 border border-fuel-amber/10 px-3.5 py-1.5 rounded-lg">
              <AlertTriangle size={14} /> Sheet already exists for this date.
            </div>
          ) : (
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || isLoading}
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer shadow-md shadow-fuel-amber/15"
            >
              {isGenerating ? "Generating..." : "Generate & Save Daily Sheet"}
            </Button>
          )}
        </div>
      </Card>

      {/* KPI summaries cards grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="glass border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-fuel-amber/10 text-fuel-amber flex items-center justify-center shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono text-ink-subtle">Total Cash Inflow</p>
              <p className="text-base font-black text-ink mt-0.5">{formatCurrencyIN(totalCashCollected)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-fuel-amber/10 text-fuel-amber flex items-center justify-center shrink-0">
              <Receipt size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono text-ink-subtle">Credit Sales Amount</p>
              <p className="text-base font-black text-ink mt-0.5">{formatCurrencyIN(totalInvoiceSales)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-fuel-amber/10 text-fuel-amber flex items-center justify-center shrink-0">
              <PiggyBank size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono text-ink-subtle">Payments Received</p>
              <p className="text-base font-black text-ink mt-0.5">{formatCurrencyIN(totalPaymentsCollected)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-fuel-amber/10 text-fuel-amber flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono text-ink-subtle">Total Volume Sold</p>
              <p className="text-base font-black text-ink mt-0.5 font-mono">
                {isLoading ? "..." : `${totalLitersSold.toFixed(2)} L`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-ink-subtle">Compiling preview logs...</div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Left Column: Nozzles breakdown */}
          <div className="lg:col-span-1">
            <Card className="glass border-hairline">
              <CardContent className="p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold mb-3 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-success" /> Nozzle Meters Sales
                </h3>
                {salesForm?.items && salesForm.items.length > 0 ? (
                  <div className="space-y-2">
                    {salesForm.items.map((item) => {
                      const opening = item.opening_reading || 0;
                      const closing = item.closing_reading !== null ? item.closing_reading : null;
                      const sales = closing !== null && closing >= opening ? closing - opening : 0;
                      return (
                        <div
                          key={item.nozzle_uuid}
                          className="bg-surface-2 p-2.5 rounded-lg border border-hairline flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-ink">{item.nozzle_name}</p>
                            <p className="text-[9px] text-ink-subtle font-mono mt-0.5">
                              {opening.toFixed(1)} L → {closing !== null ? closing.toFixed(1) : "—"} L
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className="text-[8px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent mb-1">
                              {item.fuel_type}
                            </Badge>
                            <p className="text-xs font-mono font-black text-ink">
                              {closing !== null ? `${sales.toFixed(1)} L` : "No reading"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-xs text-ink-subtle italic py-6">No nozzle logs for this date.</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Transactions tables */}
          <div className="lg:col-span-2 space-y-6">
            {/* Credit slips */}
            <Card className="glass border-hairline">
              <CardContent className="p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold mb-3 flex items-center gap-1.5">
                  <Receipt size={13} className="text-fuel-amber" /> Credit Sales (Slips / Invoices)
                </h3>
                {dailyVouchers?.items && dailyVouchers.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-hairline hover:bg-transparent">
                          <TableHead className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Invoice #
                          </TableHead>
                          <TableHead className="py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Customer
                          </TableHead>
                          <TableHead className="py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Vehicle / Ref
                          </TableHead>
                          <TableHead className="py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Volume
                          </TableHead>
                          <TableHead className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle text-right">
                            Amount
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyVouchers.items.map((voucher) => (
                          <TableRow key={voucher.uuid} className="border-b border-hairline hover:bg-surface-3/10 font-mono">
                            <TableCell className="px-3 py-2 text-xs text-ink font-semibold">
                              {voucher.invoice_number}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-semibold text-ink-muted">
                              {voucher.customer_name}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-ink-subtle font-sans">
                              {voucher.vehicle_number || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-ink-muted">
                              {Number(voucher.quantity_liters).toFixed(1)} L ({voucher.fuel_type})
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right text-xs font-black text-ink">
                              {formatCurrencyIN(Number(voucher.total_amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-surface-3/20 hover:bg-surface-3/20">
                          <TableCell colSpan={4} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">
                            Total
                          </TableCell>
                          <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">
                            {formatCurrencyIN(totalInvoiceSales)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-subtle italic">No credit invoices found on this date.</div>
                )}
              </CardContent>
            </Card>

            {/* Payments */}
            <Card className="glass border-hairline">
              <CardContent className="p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold mb-3 flex items-center gap-1.5">
                  <PiggyBank size={13} className="text-fuel-amber" /> Payments Log (Accounts Received)
                </h3>
                {dailyPayments?.items && dailyPayments.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-hairline hover:bg-transparent">
                          <TableHead className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Ref / Time
                          </TableHead>
                          <TableHead className="py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Customer
                          </TableHead>
                          <TableHead className="py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                            Payment Mode
                          </TableHead>
                          <TableHead className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-subtle text-right">
                            Amount
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyPayments.items.map((payment) => (
                          <TableRow key={payment.uuid} className="border-b border-hairline hover:bg-surface-3/10 font-mono">
                            <TableCell className="px-3 py-2 text-xs text-ink-subtle">
                              {payment.reference_number || payment.payment_date || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-semibold text-ink-muted">
                              {payment.customer_name}
                            </TableCell>
                            <TableCell className="py-2 text-xs">
                              <Badge className="text-[8px] px-1.5 py-0 bg-fuel-amber/10 text-fuel-amber border-transparent hover:bg-fuel-amber/10 font-bold">
                                {payment.payment_mode}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-right text-xs font-black text-ink">
                              {formatCurrencyIN(Number(payment.amount))}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-surface-3/20 hover:bg-surface-3/20">
                          <TableCell colSpan={3} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">
                            Total
                          </TableCell>
                          <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">
                            {formatCurrencyIN(totalPaymentsCollected)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-subtle italic">No payments on this date.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
