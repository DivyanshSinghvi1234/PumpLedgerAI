import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Coins,
  FileText,
  Printer,
  TrendingUp,
  Receipt,
  PiggyBank,
  CheckCircle2,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import voucherService from "@/features/vouchers/services/voucherService";

export default function DailySheetPage() {
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split("T")[0]);

  // Queries
  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["salesReadings", salesDate],
    queryFn: () => inventoryService.getBulkReadingsForm(salesDate),
  });

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["dailyPayments", salesDate],
    queryFn: () => paymentService.getPayments({ payment_date: salesDate, page_size: 100 }),
  });

  const { data: dailyVouchers, isLoading: vouchersLoading } = useQuery({
    queryKey: ["dailyVouchers", salesDate],
    queryFn: () => voucherService.getVouchers({ from_date: salesDate, to_date: salesDate, page_size: 100 }),
  });

  // Dispenser readings grouping
  const salesDispenserGroups = useMemo(() => {
    if (!salesForm?.items) return {};
    const groups: Record<string, typeof salesForm.items> = {};
    salesForm.items.forEach((item) => {
      const dName = item.dispenser_name;
      if (!groups[dName]) {
        groups[dName] = [];
      }
      groups[dName].push(item);
    });
    return groups;
  }, [salesForm]);

  // Total calculations
  const totalLitersSold = useMemo(() => {
    if (!salesForm?.items) return 0;
    return salesForm.items.reduce((sum, item) => {
      const opening = item.opening_reading || 0;
      const closing = item.closing_reading !== null ? item.closing_reading : null;
      if (closing !== null && closing >= opening) {
        return sum + (closing - opening);
      }
      return sum;
    }, 0);
  }, [salesForm]);

  const totalInvoiceSales = useMemo(() => {
    if (!dailyVouchers?.items) return 0;
    return dailyVouchers.items.reduce((sum, v) => sum + Number(v.total_amount), 0);
  }, [dailyVouchers]);

  const totalPaymentsCollected = useMemo(() => {
    if (!dailyPayments?.items) return 0;
    return dailyPayments.items.reduce((sum, p) => sum + Number(p.amount), 0);
  }, [dailyPayments]);

  const totalCashCollected = useMemo(() => {
    // CASH payments
    const cashPayments = dailyPayments?.items
      ? dailyPayments.items.filter((p) => p.payment_mode === "CASH").reduce((sum, p) => sum + Number(p.amount), 0)
      : 0;

    // CASH vouchers
    const cashVouchers = dailyVouchers?.items
      ? dailyVouchers.items.filter((v) => v.payment_mode === "CASH").reduce((sum, v) => sum + Number(v.total_amount), 0)
      : 0;

    return cashPayments + cashVouchers;
  }, [dailyPayments, dailyVouchers]);

  const handlePrint = () => {
    window.print();
  };

  if (salesFormLoading || paymentsLoading || vouchersLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      {/* Header with printing toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between no-print">
        <PageHeader
          title="Daily Sheet"
          description="Detailed daily operational overview comprising nozzle sales volumes, invoice vouchers, payments, and cash summaries."
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="salesDateInput" className="text-xs font-semibold text-ink-muted shrink-0">
              Accounting Date:
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const d = new Date(salesDate);
                  d.setDate(d.getDate() - 1);
                  setSalesDate(d.toISOString().split("T")[0]);
                }}
                className="h-8 w-8 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer"
                title="Previous Day"
              >
                &larr;
              </Button>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer transition-colors"
                  size={14}
                  onClick={() => {
                    const el = document.getElementById("salesDateInput") as HTMLInputElement | null;
                    if (el && typeof el.showPicker === "function") {
                      el.showPicker();
                    }
                  }}
                />
                <Input
                  id="salesDateInput"
                  type="date"
                  value={salesDate}
                  onChange={(e) => setSalesDate(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-xs text-ink pl-9 pr-2 py-1 h-8 w-32"
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const d = new Date(salesDate);
                  d.setDate(d.getDate() + 1);
                  setSalesDate(d.toISOString().split("T")[0]);
                }}
                className="h-8 w-8 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer"
                title="Next Day"
              >
                &rarr;
              </Button>
            </div>
          </div>
          <Button
            onClick={handlePrint}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15 cursor-pointer text-xs h-8"
          >
            <Printer size={14} className="mr-1.5" /> Print Sheet (PDF)
          </Button>
        </div>
      </div>

      {/* Main Printable Accounting Sheet Container */}
      <div id="daily-sheet-print-container" className="space-y-6">
        
        {/* Printable Sheet Header (Visible only when printing) */}
        <div className="hidden print:block border-b border-zinc-300 pb-3 mb-6">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-950">PumpLedger AI — Daily Accounting Sheet</h1>
              <p className="text-[10px] text-zinc-500 mt-0.5">Automated Daily Operational Ledger</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">Log Date</span>
              <p className="text-sm font-bold text-zinc-950 mt-0.5">{new Date(salesDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Dynamic Totals Dashboard Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass border-hairline print-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber bg-print-accent animate-pulse-slow">
                <Receipt size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">Total Meter Sales</p>
                <p className="text-base font-black text-ink font-mono mt-0.5">
                  {totalLitersSold.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-hairline print-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber bg-print-accent">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">Total Voucher Sales</p>
                <p className="text-base font-black text-ink font-mono mt-0.5">
                  ₹{totalInvoiceSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-hairline print-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber bg-print-accent">
                <Coins size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">Payments Collected</p>
                <p className="text-base font-black text-ink font-mono mt-0.5">
                  ₹{totalPaymentsCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-hairline print-card border-fuel-amber bg-fuel-amber/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/20 text-fuel-amber bg-print-accent">
                <PiggyBank size={18} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-fuel-amber font-bold">Total Cash Received</p>
                <p className="text-base font-black text-fuel-amber font-mono mt-0.5">
                  ₹{totalCashCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full-Width Nozzle Readings Worksheet */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-fuel-amber" /> Nozzle Readings Worksheet
            </h3>
          </div>

          {Object.keys(salesDispenserGroups).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(salesDispenserGroups).map(([dispenserName, items]) => (
                <Card key={dispenserName} className="glass border-hairline overflow-hidden print-card">
                  <div className="p-3.5 flex flex-col md:flex-row md:items-center gap-4">
                    {/* Dispenser Name Label (Row Header on Left) */}
                    <div className="w-full md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-hairline pb-2 md:pb-0 md:pr-4 flex items-center justify-between md:block bg-print-accent">
                      <span className="text-xs font-black text-ink uppercase tracking-wider font-mono">
                        {dispenserName}
                      </span>
                      <Badge className="md:hidden bg-fuel-amber/10 text-fuel-amber text-[8px] font-bold">
                        {items.length} Nozzles
                      </Badge>
                    </div>

                    {/* Nozzle Grid (Row Cells on Right) */}
                    <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-3 print-nozzle-grid">
                      {items.map((item) => {
                        const opening = item.opening_reading || 0;
                        const closing = item.closing_reading !== null ? item.closing_reading : null;
                        const sales = closing !== null && closing >= opening ? closing - opening : null;

                        return (
                          <div
                            key={item.nozzle_uuid}
                            className="border border-hairline rounded bg-surface-2 flex flex-col text-center divide-y divide-hairline print-nozzle-box shadow-sm"
                          >
                            {/* Nozzle Header */}
                            <div className="bg-surface-3/50 px-1 py-1 font-bold text-[10px] text-ink flex items-center justify-center gap-1.5 bg-print-accent">
                              <span className="truncate max-w-[60px]">{item.nozzle_name}</span>
                              <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/10 text-fuel-amber border-transparent font-bold print-badge">
                                {item.fuel_type === "SPEED" ? "SPEED" : item.fuel_type}
                              </Badge>
                            </div>

                            {/* Closing Reading */}
                            <div className="py-1 px-1.5">
                              <div className="text-[8px] uppercase font-mono text-ink-subtle">Closing</div>
                              <div className="text-xs font-bold text-ink mt-0.5 font-mono">
                                {closing !== null ? closing.toLocaleString(undefined, { minimumFractionDigits: 1 }) : "—"}
                              </div>
                            </div>

                            {/* Opening Reading */}
                            <div className="py-1 px-1.5">
                              <div className="text-[8px] uppercase font-mono text-ink-subtle">Opening</div>
                              <div className="text-xs font-bold text-ink-muted mt-0.5 font-mono">
                                {opening.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                              </div>
                            </div>

                            {/* Liters Sold */}
                            <div className="py-1 px-1.5 bg-fuel-amber/5">
                              <div className="text-[8px] uppercase font-mono text-fuel-amber font-bold">Liters</div>
                              <div className="text-xs font-black text-fuel-amber mt-0.5 font-mono">
                                {sales !== null ? `${sales.toLocaleString(undefined, { minimumFractionDigits: 1 })} L` : "—"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="glass border-hairline p-8 text-center text-xs text-ink-subtle italic print-card">
              No active dispenser machines or nozzle readings saved for this date.
            </Card>
          )}
        </div>

        {/* Side-by-Side Content Grid (Vouchers and Payments lists) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-grid">
          
          {/* Voucher Invoices List */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
              <FileText size={14} className="text-fuel-amber" /> Voucher Credit/Cash Sales
            </h3>
            
            <Card className="glass border-hairline overflow-hidden print-card">
              <CardContent className="p-0">
                {dailyVouchers && dailyVouchers.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table className="print-table">
                      <TableHeader>
                        <TableRow className="border-b border-hairline hover:bg-transparent">
                          <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Invoice / Customer
                          </TableHead>
                          <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Vehicle
                          </TableHead>
                          <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Fuel / Qty
                          </TableHead>
                          <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Mode
                          </TableHead>
                          <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                            Amount (₹)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyVouchers.items.map((voucher) => (
                          <TableRow key={voucher.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                            <TableCell className="px-3 py-1.5 text-xs">
                              <div className="font-bold text-ink truncate max-w-[120px]">{voucher.invoice_number}</div>
                              <div className="text-[9px] text-ink-subtle truncate max-w-[120px]">{voucher.customer_name || "—"}</div>
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-ink-muted font-semibold">
                              {voucher.vehicle_number || "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-ink-muted font-mono">
                              <div>{voucher.fuel_type}</div>
                              <div className="text-[9px] text-ink-subtle">{voucher.quantity_liters.toFixed(2)} L</div>
                            </TableCell>
                            <TableCell className="py-1.5 text-xs">
                              <Badge className={`text-[8px] px-1 py-0 uppercase border-transparent font-bold print-badge ${
                                voucher.payment_mode === "CREDIT" 
                                  ? "bg-red-500/10 text-red-500" 
                                  : "bg-fuel-amber/15 text-fuel-amber"
                              }`}>
                                {voucher.payment_mode}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">
                              ₹{voucher.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total Row */}
                        <TableRow className="bg-surface-3/20 font-bold hover:bg-surface-3/20 border-t border-hairline bg-print-accent">
                          <TableCell colSpan={4} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">
                            Total Invoice Sales:
                          </TableCell>
                          <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">
                            ₹{totalInvoiceSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-subtle italic">
                    No invoices or credit sales generated on this date.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payments List */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
              <Coins size={14} className="text-fuel-amber" /> Payments Collection Summaries
            </h3>
            
            <Card className="glass border-hairline overflow-hidden print-card">
              <CardContent className="p-0">
                {dailyPayments && dailyPayments.items.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table className="print-table">
                      <TableHeader>
                        <TableRow className="border-b border-hairline hover:bg-transparent">
                          <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Customer
                          </TableHead>
                          <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Payment Mode
                          </TableHead>
                          <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">
                            Reference / Remarks
                          </TableHead>
                          <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                            Amount (₹)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyPayments.items.map((payment) => (
                          <TableRow key={payment.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                            <TableCell className="px-3 py-1.5 text-xs font-bold text-ink">
                              {payment.customer_name}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs font-semibold text-ink-muted">
                              <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/15 text-fuel-amber border-transparent print-badge font-bold">
                                {payment.payment_mode}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-xs font-mono">
                              <div className="text-ink truncate max-w-[120px]">{payment.reference_number || "—"}</div>
                              <div className="text-[9px] text-ink-subtle truncate max-w-[120px] italic">{payment.remarks || ""}</div>
                            </TableCell>
                            <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">
                              ₹{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Total Row */}
                        <TableRow className="bg-surface-3/20 font-bold hover:bg-surface-3/20 border-t border-hairline bg-print-accent">
                          <TableCell colSpan={3} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">
                            Total Payments Collected:
                          </TableCell>
                          <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">
                            ₹{totalPaymentsCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-ink-subtle italic">
                    No customer payment receipts logged on this date.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Print Disclaimer (Visible only when printing) */}
        <div className="hidden print:block text-center border-t border-zinc-200 pt-3 mt-6 text-[8px] text-zinc-400 font-mono">
          Generated automatically by PumpLedgerAI. Page 1 of 1. All records verified.
        </div>

      </div>
    </div>
  );
}
