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

  const litersByFuel = useMemo(() => {
    if (!salesForm?.items) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const item of salesForm.items) {
      const opening = item.opening_reading || 0;
      const closing = item.closing_reading !== null ? item.closing_reading : null;
      if (closing !== null && closing >= opening) {
        const fuel = item.fuel_type === "SPEED" ? "SPEED" : item.fuel_type;
        map.set(fuel, (map.get(fuel) || 0) + (closing - opening));
      }
    }
    return map;
  }, [salesForm]);

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
      <div id="daily-sheet-print-container">

        {/* ─── PRINT-ONLY: Professional Accounting Document ─── */}
        <div className="hidden print:block">

          {/* Document Header */}
          <div className="print-header">
            <p className="station-name">PUMPLEDGER AI</p>
            <p className="doc-title">Daily Accounting Sheet</p>
            <p className="doc-meta">
              <span>Date: {new Date(salesDate).toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
              <span>Generated: {new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            </p>
          </div>

          {/* Summary KPIs */}
          <table className="print-summary-table">
            <tbody>
              <tr>
                <td>
                  <p className="kpi-label">Total Meter Sales</p>
                  <p className="kpi-value">{totalLitersSold.toLocaleString("en-IN", { minimumFractionDigits: 2 })} L</p>
                </td>
                <td>
                  <p className="kpi-label">Total Voucher Sales</p>
                  <p className="kpi-value">₹{totalInvoiceSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </td>
                <td>
                  <p className="kpi-label">Payments Collected</p>
                  <p className="kpi-value">₹{totalPaymentsCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </td>
                <td className="kpi-cash">
                  <p className="kpi-label">Cash Received</p>
                  <p className="kpi-value">₹{totalCashCollected.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Nozzle Readings Table */}
          <p className="print-section-title">Nozzle Readings</p>
          {salesForm?.items && salesForm.items.length > 0 ? (
            <table className="print-data-table">
              <thead>
                <tr>
                  <th style={{ width: "28%" }}>Nozzle</th>
                  <th style={{ width: "18%" }}>Fuel Type</th>
                  <th className="right" style={{ width: "18%" }}>Opening (L)</th>
                  <th className="right" style={{ width: "18%" }}>Closing (L)</th>
                  <th className="right" style={{ width: "18%" }}>Sales (L)</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const fuelOrder = ["DIESEL", "PETROL", "LUBRICANT", "SPEED"];
                  const grouped = new Map<string, typeof salesForm.items>();
                  for (const item of salesForm.items) {
                    const fuel = item.fuel_type === "SPEED" ? "SPEED" : item.fuel_type;
                    if (!grouped.has(fuel)) grouped.set(fuel, []);
                    grouped.get(fuel)!.push(item);
                  }
                  const rows = new Array<any>();
                  for (const fuel of fuelOrder) {
                    const items = grouped.get(fuel);
                    if (!items) continue;
                    for (const item of items) {
                      const opening = item.opening_reading || 0;
                      const closing = item.closing_reading !== null ? item.closing_reading : null;
                      const sales = closing !== null && closing >= opening ? closing - opening : null;
                      rows.push(
                        <tr key={item.nozzle_uuid}>
                          <td style={{ fontWeight: 600 }}>{item.nozzle_name}</td>
                          <td>{fuel}</td>
                          <td className="right">{opening.toLocaleString("en-IN", { minimumFractionDigits: 1 })}</td>
                          <td className="right">{closing !== null ? closing.toLocaleString("en-IN", { minimumFractionDigits: 1 }) : "—"}</td>
                          <td className="right">{sales !== null ? sales.toLocaleString("en-IN", { minimumFractionDigits: 1 }) : "—"}</td>
                        </tr>
                      );
                    }
                  }
                  const presentFuels = fuelOrder.filter(f => grouped.has(f));
                  const fuelParts = presentFuels
                    .map(f => `${f} ${(litersByFuel.get(f) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })} L`);
                  rows.push(
                    <tr className="total-row" key="grand-total">
                      <td colSpan={5} className="right" style={{ fontSize: "8.5pt", letterSpacing: "0.5pt" }}>
                        {fuelParts.join("  |  ")}  |  TOTAL {totalLitersSold.toLocaleString("en-IN", { minimumFractionDigits: 2 })} L
                      </td>
                    </tr>
                  );
                  return rows;
                })()}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: "9pt", color: "#888", fontStyle: "italic", margin: "6pt 0" }}>
              No active nozzle readings saved for this date.
            </p>
          )}

          {/* Voucher Sales Table */}
          <p className="print-section-title">Voucher Credit / Cash Sales</p>
          {dailyVouchers && dailyVouchers.items.length > 0 ? (
            <table className="print-data-table">
              <thead>
                <tr>
                  <th style={{ width: "16%" }}>Invoice No.</th>
                  <th style={{ width: "20%" }}>Customer</th>
                  <th style={{ width: "12%" }}>Vehicle</th>
                  <th style={{ width: "10%" }}>Fuel</th>
                  <th className="right" style={{ width: "10%" }}>Qty (L)</th>
                  <th style={{ width: "10%" }}>Mode</th>
                  <th className="right" style={{ width: "22%" }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {dailyVouchers.items.map((voucher) => (
                  <tr key={voucher.uuid}>
                    <td style={{ fontWeight: 600 }}>{voucher.invoice_number}</td>
                    <td>{voucher.customer_name || "—"}</td>
                    <td>{voucher.vehicle_number || "—"}</td>
                    <td>{voucher.fuel_type}</td>
                    <td className="right">{Number(voucher.quantity_liters).toFixed(2)}</td>
                    <td>{voucher.payment_mode}</td>
                    <td className="right">₹{Number(voucher.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={6} className="right">Total Voucher Sales</td>
                  <td className="right">₹{Number(totalInvoiceSales).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: "9pt", color: "#888", fontStyle: "italic", margin: "6pt 0" }}>
              No invoices or credit sales generated on this date.
            </p>
          )}

          {/* Payments Collection Table */}
          <p className="print-section-title">Payments Collection Summary</p>
          {dailyPayments && dailyPayments.items.length > 0 ? (
            <table className="print-data-table">
              <thead>
                <tr>
                  <th style={{ width: "25%" }}>Customer</th>
                  <th style={{ width: "15%" }}>Payment Mode</th>
                  <th style={{ width: "25%" }}>Reference</th>
                  <th style={{ width: "20%" }}>Remarks</th>
                  <th className="right" style={{ width: "15%" }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {dailyPayments.items.map((payment) => (
                  <tr key={payment.uuid}>
                    <td style={{ fontWeight: 600 }}>{payment.customer_name}</td>
                    <td>{payment.payment_mode}</td>
                    <td>{payment.reference_number || "—"}</td>
                    <td>{payment.remarks || ""}</td>
                    <td className="right">₹{Number(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td colSpan={4} className="right">Total Payments Collected</td>
                  <td className="right">₹{Number(totalPaymentsCollected).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: "9pt", color: "#888", fontStyle: "italic", margin: "6pt 0" }}>
              No customer payment receipts logged on this date.
            </p>
          )}

          {/* Footer */}
          <div className="print-footer">
            Generated automatically by PumpLedger AI &mdash; {new Date().toLocaleString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

        {/* ─── SCREEN-ONLY: Interactive Dashboard Layout ─── */}
        <div className="print:hidden space-y-6">

          {/* Dynamic Totals Dashboard Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass border-hairline">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
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

            <Card className="glass border-hairline">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
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

            <Card className="glass border-hairline">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
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

            <Card className="glass border-hairline border-fuel-amber bg-fuel-amber/5">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-fuel-amber/20 text-fuel-amber">
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

            {salesForm?.items && salesForm.items.length > 0 ? (
              <Card className="glass border-hairline p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {salesForm.items.map((item) => {
                    const opening = item.opening_reading || 0;
                    const closing = item.closing_reading !== null ? item.closing_reading : null;
                    const sales = closing !== null && closing >= opening ? closing - opening : null;

                    return (
                      <div
                        key={item.nozzle_uuid}
                        className="border border-hairline rounded bg-surface-2 flex flex-col text-center divide-y divide-hairline shadow-sm"
                      >
                        <div className="bg-surface-3/50 px-1 py-1 font-bold text-[10px] text-ink flex items-center justify-center gap-1.5">
                          <span className="truncate max-w-[60px]">{item.nozzle_name}</span>
                          <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/10 text-fuel-amber border-transparent font-bold">
                            {item.fuel_type === "SPEED" ? "SPEED" : item.fuel_type}
                          </Badge>
                        </div>
                        <div className="py-1 px-1.5">
                          <div className="text-[8px] uppercase font-mono text-ink-subtle">Closing</div>
                          <div className="text-xs font-bold text-ink mt-0.5 font-mono">
                            {closing !== null ? closing.toLocaleString(undefined, { minimumFractionDigits: 1 }) : "—"}
                          </div>
                        </div>
                        <div className="py-1 px-1.5">
                          <div className="text-[8px] uppercase font-mono text-ink-subtle">Opening</div>
                          <div className="text-xs font-bold text-ink-muted mt-0.5 font-mono">
                            {opening.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                          </div>
                        </div>
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
              </Card>
            ) : (
              <Card className="glass border-hairline p-8 text-center text-xs text-ink-subtle italic">
                No active nozzle readings saved for this date.
              </Card>
            )}
          </div>

          {/* Side-by-Side Content Grid (Vouchers and Payments lists) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Voucher Invoices List */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
                <FileText size={14} className="text-fuel-amber" /> Voucher Credit/Cash Sales
              </h3>

              <Card className="glass border-hairline overflow-hidden">
                <CardContent className="p-0">
                  {dailyVouchers && dailyVouchers.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
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
                                <div className="text-[9px] text-ink-subtle">{Number(voucher.quantity_liters).toFixed(2)} L</div>
                              </TableCell>
                              <TableCell className="py-1.5 text-xs">
                                <Badge className={`text-[8px] px-1 py-0 uppercase border-transparent font-bold ${
                                  voucher.payment_mode === "CREDIT"
                                    ? "bg-red-500/10 text-red-500"
                                    : "bg-fuel-amber/15 text-fuel-amber"
                                }`}>
                                  {voucher.payment_mode}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">
                                ₹{Number(voucher.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-surface-3/20 font-bold hover:bg-surface-3/20 border-t border-hairline">
                            <TableCell colSpan={4} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">
                              Total Invoice Sales:
                            </TableCell>
                            <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">
                              ₹{Number(totalInvoiceSales).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

              <Card className="glass border-hairline overflow-hidden">
                <CardContent className="p-0">
                  {dailyPayments && dailyPayments.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
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
                                <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/15 text-fuel-amber border-transparent font-bold">
                                  {payment.payment_mode}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-1.5 text-xs font-mono">
                                <div className="text-ink truncate max-w-[120px]">{payment.reference_number || "—"}</div>
                                <div className="text-[9px] text-ink-subtle truncate max-w-[120px] italic">{payment.remarks || ""}</div>
                              </TableCell>
                              <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">
                                ₹{Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-surface-3/20 font-bold hover:bg-surface-3/20 border-t border-hairline">
                            <TableCell colSpan={3} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">
                              Total Payments Collected:
                            </TableCell>
                            <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">
                              ₹{Number(totalPaymentsCollected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        </div>

      </div>
    </div>
  );
}
