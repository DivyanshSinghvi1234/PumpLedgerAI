import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Coins,
  FileText,
  Printer,
  Receipt,
  PiggyBank,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  MessageSquare,
  Clock,
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import voucherService from "@/features/vouchers/services/voucherService";
import dailySheetService from "@/features/daily-sheet/services/dailySheetService";
import type { DailySheet } from "@/features/daily-sheet/services/dailySheetService";

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatCurrencyIN(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface SheetDetailProps {
  sheet: DailySheet;
  onClose: () => void;
  hideBackButton?: boolean;
}

export default function SheetDetail({ sheet, onClose, hideBackButton }: SheetDetailProps) {
  const queryClient = useQueryClient();
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [remarksInput, setRemarksInput] = useState(sheet.remarks || "");

  const [editingPeriod, setEditingPeriod] = useState(false);
  const [editDate, setEditDate] = useState(sheet.date);
  const [editPeriodStart, setEditPeriodStart] = useState(sheet.period_start || "");
  const [editPeriodEnd, setEditPeriodEnd] = useState(sheet.period_end || "");

  const voucherParams = sheet.period_start && sheet.period_end
    ? {
        from_datetime: sheet.period_start,
        to_datetime: sheet.period_end,
        page_size: 100,
      }
    : { from_date: sheet.date, to_date: sheet.date, page_size: 100 };

  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["sheetReadings", sheet.uuid, sheet.date],
    queryFn: () => inventoryService.getBulkReadingsForm(sheet.date),
  });

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["sheetPayments", sheet.uuid, sheet.date],
    queryFn: () =>
      paymentService.getPayments({ payment_date: sheet.date, page_size: 100 }),
  });

  const { data: dailyVouchers, isLoading: vouchersLoading } = useQuery({
    queryKey: ["sheetVouchers", sheet.uuid, voucherParams],
    queryFn: () => voucherService.getVouchers(voucherParams),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file }: { file: File }) =>
      dailySheetService.uploadManualSheet(sheet.uuid, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      toast.success("Manual sheet image uploaded successfully!");
    },
    onError: () => {
      toast.error("Failed to upload manual sheet image.");
    },
  });

  const updateSheetMutation = useMutation({
    mutationFn: (options: {
      remarks?: string;
      date?: string;
      period_start?: string;
      period_end?: string;
    }) => dailySheetService.updateDailySheet(sheet.uuid, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      queryClient.invalidateQueries({ queryKey: ["dailySheet", sheet.date] });
      queryClient.invalidateQueries({ queryKey: ["sheetReadings", sheet.uuid] });
      queryClient.invalidateQueries({ queryKey: ["sheetPayments", sheet.uuid] });
      queryClient.invalidateQueries({ queryKey: ["sheetVouchers", sheet.uuid] });
      setEditingRemarks(false);
      setEditingPeriod(false);
      toast.success("Daily sheet updated successfully!");
    },
    onError: () => {
      toast.error("Failed to update daily sheet details.");
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate({ file: e.target.files[0] });
    }
  };

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
    <div className="space-y-6">
      {/* Detail header */}
      <div className="flex items-center gap-3 flex-wrap">
        {!hideBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-ink-muted hover:text-ink h-7 text-xs cursor-pointer"
          >
            ← Back to Sheets
          </Button>
        )}
        {editingPeriod ? (
          <div className="flex-1 min-w-0 border border-hairline rounded-lg p-4 bg-surface-2 space-y-3 no-print">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <h4 className="text-xs font-bold text-ink">Edit Sheet Timing & Date</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Accounting Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-surface-1 border-hairline text-sm h-10 px-3 rounded-lg text-ink"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Period Start</Label>
                <Input
                  type="datetime-local"
                  value={editPeriodStart ? toDatetimeLocal(new Date(editPeriodStart)) : ""}
                  onChange={(e) => setEditPeriodStart(new Date(e.target.value).toISOString())}
                  className="bg-surface-1 border-hairline text-sm h-10 px-3 rounded-lg text-ink"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Period End</Label>
                <Input
                  type="datetime-local"
                  value={editPeriodEnd ? toDatetimeLocal(new Date(editPeriodEnd)) : ""}
                  onChange={(e) => setEditPeriodEnd(new Date(e.target.value).toISOString())}
                  className="bg-surface-1 border-hairline text-sm h-10 px-3 rounded-lg text-ink"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingPeriod(false)}
                className="h-8 text-xs text-ink-subtle"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  updateSheetMutation.mutate({
                    date: editDate,
                    period_start: editPeriodStart,
                    period_end: editPeriodEnd,
                  })
                }
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold h-8 text-xs rounded-lg px-3"
              >
                Save Timeline
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2 flex-wrap">
              <span>
                {new Date(sheet.date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <Badge className="text-[9px] uppercase font-mono font-bold bg-success/15 text-success hover:bg-success/15 border-transparent">
                Saved & Locked
              </Badge>
              <button
                onClick={() => setEditingPeriod(true)}
                className="text-[10px] text-fuel-amber hover:underline font-semibold ml-2 no-print cursor-pointer"
              >
                [Edit Timing]
              </button>
            </h2>
            <p className="text-xs text-ink-subtle font-mono mt-1 flex items-center gap-1.5 flex-wrap">
              <Clock size={11} />
              <span>
                Period: {fmtDt(sheet.period_start)} to {fmtDt(sheet.period_end)}
              </span>
            </p>
          </div>
        )}
        <div className="flex gap-2 shrink-0 no-print">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="border-hairline bg-surface-2 hover:bg-surface-3 text-xs h-8 text-ink font-semibold"
          >
            <Printer size={13} className="mr-1.5 text-fuel-amber" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards Summary Grid */}
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
        <div className="py-24 text-center text-xs text-ink-subtle">Retrieving daily transaction audit logs...</div>
      ) : (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Left Column: Nozzles & Manual Uploads */}
          <div className="lg:col-span-1 space-y-6">
            {/* Nozzles breakdown */}
            <Card className="glass border-hairline">
              <CardContent className="p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold mb-3 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-success" /> Nozzle Meters Closing
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

            {/* Manual sheet image panel */}
            <Card className="glass border-hairline">
              <CardContent className="p-4 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-fuel-amber" /> Attendant Physical Sheet Scan
                </h3>
                {sheet.manual_sheet_image ? (
                  <div className="space-y-3">
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-hairline bg-surface-2 group">
                      <img
                        src={`${dailySheetService.getBaseUrl()}${sheet.manual_sheet_image}`}
                        alt="Manual Sheet Scan"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity no-print">
                        <a
                          href={`${dailySheetService.getBaseUrl()}${sheet.manual_sheet_image}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-canvas hover:bg-surface-3 text-ink text-xs font-bold px-3 py-1.5 rounded shadow cursor-pointer"
                        >
                          View Full Image
                        </a>
                      </div>
                    </div>
                    {/* Allow re-upload */}
                    <div className="flex items-center gap-2 no-print">
                      <Label
                        htmlFor="manual-sheet-reupload"
                        className="flex-1 flex items-center justify-center gap-1.5 border border-hairline rounded-md py-1.5 text-xs text-ink hover:bg-surface-3 cursor-pointer transition-colors"
                      >
                        <Upload size={12} /> Replace Image
                      </Label>
                      <Input
                        id="manual-sheet-reupload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-hairline rounded-lg p-6 text-center space-y-3 no-print">
                    <ImageIcon className="mx-auto text-ink-subtle" size={28} />
                    <p className="text-xs text-ink-muted">Attach digital copy of physical sheet</p>
                    <Label
                      htmlFor="manual-sheet-upload"
                      className="inline-flex items-center justify-center gap-1.5 bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-4 py-2 rounded text-xs cursor-pointer shadow"
                    >
                      <Upload size={12} /> Upload Scan
                    </Label>
                    <Input
                      id="manual-sheet-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Remarks block */}
            <Card className="glass border-hairline">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5">
                    <MessageSquare size={13} className="text-fuel-amber" /> Manager Notes & Remarks
                  </h3>
                  {!editingRemarks && (
                    <button
                      onClick={() => {
                        setRemarksInput(sheet.remarks || "");
                        setEditingRemarks(true);
                      }}
                      className="text-[10px] text-fuel-amber hover:underline font-semibold no-print cursor-pointer"
                    >
                      [Edit]
                    </button>
                  )}
                </div>
                {editingRemarks ? (
                  <div className="space-y-2 no-print">
                    <Textarea
                      value={remarksInput}
                      onChange={(e) => setRemarksInput(e.target.value)}
                      placeholder="Add remarks or notes..."
                      className="bg-surface-2 border-hairline text-xs min-h-[70px] text-ink"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingRemarks(false)}
                        className="h-7 text-xs text-ink-subtle"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateSheetMutation.mutate({ remarks: remarksInput })}
                        className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold h-7 text-xs"
                      >
                        Save Notes
                      </Button>
                    </div>
                  </div>
                ) : sheet.remarks ? (
                  <p className="text-xs text-ink leading-relaxed italic bg-surface-2/40 p-3 rounded-lg border border-hairline">
                    "{sheet.remarks}"
                  </p>
                ) : (
                  <p className="text-xs text-ink-subtle italic py-2">No remarks added to this sheet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Transactions breakdown */}
          <div className="lg:col-span-2 space-y-6">
            {/* Credit slips invoices */}
            <Card className="glass border-hairline">
              <CardContent className="p-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold mb-3 flex items-center gap-1.5">
                  <Receipt size={13} className="text-fuel-amber" /> Credit Sales (Invoices)
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
                              {voucher.customer_name || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-ink-subtle font-sans">
                              {voucher.vehicle_number || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-ink-muted">
                              {Number(voucher.quantity_liters).toFixed(2)} L
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

            {/* Payments collected */}
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
