import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  Coins,
  FileText,
  FolderOpen,
  PlusCircle,
  Printer,
  TrendingUp,
  Receipt,
  PiggyBank,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  MessageSquare,
  Trash2,
  ChevronRight,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
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
// Tabs implemented inline — no external tabs primitive needed

import inventoryService from "@/features/inventory/services/inventoryService";
import paymentService from "@/features/payments/services/paymentService";
import voucherService from "@/features/vouchers/services/voucherService";
import dailySheetService from "@/features/daily-sheet/services/dailySheetService";
import type { DailySheet } from "@/features/daily-sheet/services/dailySheetService";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format a Date to "YYYY-MM-DDTHH:mm" for datetime-local inputs */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format a stored ISO datetime for display */
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

// ─── Sheet Detail View (used inside Stored Sheets tab) ──────────────────────

interface SheetDetailProps {
  sheet: DailySheet;
  onClose: () => void;
  hideBackButton?: boolean;
}

function SheetDetail({ sheet, onClose, hideBackButton }: SheetDetailProps) {
  const queryClient = useQueryClient();
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [remarksInput, setRemarksInput] = useState("");

  const [editingPeriod, setEditingPeriod] = useState(false);
  const [editDate, setEditDate] = useState(sheet.date);
  const [editPeriodStart, setEditPeriodStart] = useState(sheet.period_start || "");
  const [editPeriodEnd, setEditPeriodEnd] = useState(sheet.period_end || "");

  // When the sheet has a time window, filter vouchers by created_at.
  // For old sheets (period_start = null) fall back to invoice_date.
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] }),
  });

  const updateSheetMutation = useMutation({
    mutationFn: (options: {
      remarks?: string;
      date?: string;
      period_start?: string;
      period_end?: string;
    }) => dailySheetService.updateDailySheet(sheet.uuid, options),
    onSuccess: (updatedSheet) => {
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      // Invalidate queries for the specific sheet parameters
      queryClient.invalidateQueries({ queryKey: ["dailySheet", sheet.date] });
      queryClient.invalidateQueries({ queryKey: ["sheetReadings", sheet.uuid] });
      queryClient.invalidateQueries({ queryKey: ["sheetPayments", sheet.uuid] });
      queryClient.invalidateQueries({ queryKey: ["sheetVouchers", sheet.uuid] });
      setEditingRemarks(false);
      setEditingPeriod(false);
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
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Accounting Date</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="bg-surface-1 border-hairline text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Period Start</Label>
                <Input
                  type="datetime-local"
                  value={editPeriodStart ? toDatetimeLocal(new Date(editPeriodStart)) : ""}
                  onChange={(e) => setEditPeriodStart(e.target.value)}
                  className="bg-surface-1 border-hairline text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Period End</Label>
                <Input
                  type="datetime-local"
                  value={editPeriodEnd ? toDatetimeLocal(new Date(editPeriodEnd)) : ""}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                  className="bg-surface-1 border-hairline text-xs h-8"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditingPeriod(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-fuel-amber text-canvas hover:bg-fuel-amber/90"
                onClick={() => {
                  updateSheetMutation.mutate({
                    date: editDate,
                    period_start: editPeriodStart ? new Date(editPeriodStart).toISOString() : undefined,
                    period_end: editPeriodEnd ? new Date(editPeriodEnd).toISOString() : undefined,
                  });
                }}
                disabled={updateSheetMutation.isPending}
              >
                {updateSheetMutation.isPending ? "Saving..." : "Save Window"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-ink truncate">
                {new Date(sheet.date).toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-fuel-amber no-print cursor-pointer"
                onClick={() => {
                  setEditDate(sheet.date);
                  setEditPeriodStart(sheet.period_start || "");
                  setEditPeriodEnd(sheet.period_end || "");
                  setEditingPeriod(true);
                }}
              >
                ✏️ Edit Period/Date
              </Button>
            </div>
            <p className="text-[10px] text-ink-muted font-mono mt-0.5">
              Period:{" "}
              <span className="text-fuel-amber font-bold">
                {fmtDt(sheet.period_start)} → {fmtDt(sheet.period_end)}
              </span>
              {!sheet.period_start && (
                <span className="ml-2 text-ink-subtle italic">(legacy — filtered by invoice date)</span>
              )}
            </p>
          </div>
        )}
        <Button
          onClick={() => window.print()}
          className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium text-xs h-8 cursor-pointer no-print"
        >
          <Printer size={13} className="mr-1.5" /> Print Sheet
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Receipt, label: "Total Meter Sales", value: `${totalLitersSold.toLocaleString(undefined, { minimumFractionDigits: 2 })} L`, amber: false },
              { icon: TrendingUp, label: "Total Voucher Sales", value: formatCurrencyIN(totalInvoiceSales), amber: false },
              { icon: Coins, label: "Payments Collected", value: formatCurrencyIN(totalPaymentsCollected), amber: false },
              { icon: PiggyBank, label: "Total Cash Received", value: formatCurrencyIN(totalCashCollected), amber: true },
            ].map(({ icon: Icon, label, value, amber }) => (
              <Card key={label} className={`glass border-hairline ${amber ? "border-fuel-amber bg-fuel-amber/5" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 flex items-center justify-center rounded-lg ${amber ? "bg-fuel-amber/20 text-fuel-amber" : "bg-fuel-amber/10 text-fuel-amber"}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className={`text-[10px] uppercase font-mono tracking-wider ${amber ? "text-fuel-amber font-bold" : "text-ink-subtle"}`}>{label}</p>
                    <p className={`text-base font-black font-mono mt-0.5 ${amber ? "text-fuel-amber" : "text-ink"}`}>{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Nozzle Readings */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5 px-1">
              <CheckCircle2 size={14} className="text-fuel-amber" /> Nozzle Readings
            </h3>
            {salesForm?.items && salesForm.items.length > 0 ? (
              <Card className="glass border-hairline p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {salesForm.items.map((item) => {
                    const opening = item.opening_reading || 0;
                    const closing = item.closing_reading !== null ? item.closing_reading : null;
                    const sales = closing !== null && closing >= opening ? closing - opening : null;
                    return (
                      <div key={item.nozzle_uuid} className="border border-hairline rounded bg-surface-2 flex flex-col text-center divide-y divide-hairline shadow-sm">
                        <div className="bg-surface-3/50 px-1 py-1 font-bold text-[10px] text-ink flex items-center justify-center gap-1.5">
                          <span className="truncate max-w-[60px]">{item.nozzle_name}</span>
                          <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/10 text-fuel-amber border-transparent font-bold">{item.fuel_type}</Badge>
                        </div>
                        <div className="py-1 px-1.5"><div className="text-[8px] uppercase font-mono text-ink-subtle">Closing</div><div className="text-xs font-bold text-ink mt-0.5 font-mono">{closing !== null ? closing.toFixed(1) : "—"}</div></div>
                        <div className="py-1 px-1.5"><div className="text-[8px] uppercase font-mono text-ink-subtle">Opening</div><div className="text-xs font-bold text-ink-muted mt-0.5 font-mono">{opening.toFixed(1)}</div></div>
                        <div className="py-1 px-1.5 bg-fuel-amber/5"><div className="text-[8px] uppercase font-mono text-fuel-amber font-bold">Liters</div><div className="text-xs font-black text-fuel-amber mt-0.5 font-mono">{sales !== null ? `${sales.toFixed(1)} L` : "—"}</div></div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="glass border-hairline p-8 text-center text-xs text-ink-subtle italic">No nozzle readings for this date.</Card>
            )}
          </div>

          {/* Vouchers + Payments side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vouchers */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
                <FileText size={14} className="text-fuel-amber" /> Vouchers in this period
              </h3>
              <Card className="glass border-hairline overflow-hidden">
                <CardContent className="p-0">
                  {dailyVouchers && dailyVouchers.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-hairline hover:bg-transparent">
                            <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Invoice / Customer</TableHead>
                            <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Fuel / Qty</TableHead>
                            <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Mode</TableHead>
                            <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyVouchers.items.map((v) => (
                            <TableRow key={v.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                              <TableCell className="px-3 py-1.5 text-xs">
                                <div className="font-bold text-ink truncate max-w-[120px]">{v.invoice_number}</div>
                                <div className="text-[9px] text-ink-subtle">{v.customer_name || "—"}</div>
                              </TableCell>
                              <TableCell className="py-1.5 text-xs text-ink-muted font-mono">
                                <div>{v.fuel_type}</div>
                                <div className="text-[9px] text-ink-subtle">{Number(v.quantity_liters).toFixed(2)} L</div>
                              </TableCell>
                              <TableCell className="py-1.5 text-xs">
                                <Badge className={`text-[8px] px-1 py-0 uppercase border-transparent font-bold ${v.payment_mode === "CREDIT" ? "bg-red-500/10 text-red-500" : "bg-fuel-amber/15 text-fuel-amber"}`}>{v.payment_mode}</Badge>
                              </TableCell>
                              <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">{formatCurrencyIN(Number(v.total_amount))}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-surface-3/20 hover:bg-surface-3/20">
                            <TableCell colSpan={3} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">Total</TableCell>
                            <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">{formatCurrencyIN(totalInvoiceSales)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-ink-subtle italic">No vouchers saved in this period.</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payments */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
                <Coins size={14} className="text-fuel-amber" /> Payments
              </h3>
              <Card className="glass border-hairline overflow-hidden">
                <CardContent className="p-0">
                  {dailyPayments && dailyPayments.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-hairline hover:bg-transparent">
                            <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Customer</TableHead>
                            <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Mode</TableHead>
                            <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyPayments.items.map((p) => (
                            <TableRow key={p.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                              <TableCell className="px-3 py-1.5 text-xs font-bold text-ink">{p.customer_name}</TableCell>
                              <TableCell className="py-1.5 text-xs">
                                <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/15 text-fuel-amber border-transparent font-bold">{p.payment_mode}</Badge>
                              </TableCell>
                              <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">{formatCurrencyIN(Number(p.amount))}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-surface-3/20 hover:bg-surface-3/20">
                            <TableCell colSpan={2} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">Total</TableCell>
                            <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">{formatCurrencyIN(totalPaymentsCollected)}</TableCell>
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

          {/* Remarks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5">
                <MessageSquare size={14} className="text-fuel-amber" /> Remarks
              </h3>
              {!editingRemarks && (
                <Button variant="ghost" size="sm" className="h-6 text-xs text-fuel-amber cursor-pointer" onClick={() => { setRemarksInput(sheet.remarks || ""); setEditingRemarks(true); }}>
                  Edit
                </Button>
              )}
            </div>
            <Card className="glass border-hairline">
              <CardContent className="p-4">
                {editingRemarks ? (
                  <div className="space-y-3">
                    <Textarea value={remarksInput} onChange={(e) => setRemarksInput(e.target.value)} placeholder="Add remarks…" className="min-h-[80px] text-sm bg-surface-2" />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingRemarks(false)}>Cancel</Button>
                      <Button size="sm" onClick={() => updateSheetMutation.mutate({ remarks: remarksInput })} disabled={updateSheetMutation.isPending} className="bg-fuel-amber text-canvas hover:bg-fuel-amber/90">
                        {updateSheetMutation.isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-ink min-h-[48px] whitespace-pre-wrap">
                    {sheet.remarks || <span className="text-ink-subtle italic">No remarks.</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Manual Sheet Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5">
                <ImageIcon size={14} className="text-fuel-amber" /> Manual Sheet Scan
              </h3>
            </div>
            <Card className="glass border-hairline">
              <CardContent className="p-4 flex flex-col items-center justify-center">
                {sheet.manual_sheet_image ? (
                  <div className="w-full max-w-2xl border border-hairline rounded overflow-hidden">
                    <img src={`/${sheet.manual_sheet_image}`} alt="Manual Sheet" className="w-full h-auto object-contain max-h-[800px]" />
                    <div className="p-3 bg-surface-2 flex justify-between items-center border-t border-hairline">
                      <span className="text-xs text-ink-subtle font-mono truncate max-w-[200px]">{sheet.manual_sheet_image.split("/").pop()}</span>
                      <div className="relative">
                        <input type="file" accept="image/jpeg,image/png,image/jpg" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={uploadMutation.isPending} />
                        <Button size="sm" variant="outline" className="h-7 text-xs pointer-events-none">{uploadMutation.isPending ? "Uploading…" : "Replace"}</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full py-10 flex flex-col items-center border-2 border-dashed border-hairline rounded-lg bg-surface-2/30 hover:bg-surface-2/60 transition-colors relative">
                    <Upload size={28} className="text-ink-subtle mb-2" />
                    <p className="text-sm font-bold text-ink">Upload Manual Sheet</p>
                    <p className="text-xs text-ink-muted mt-1 mb-4">JPG or PNG</p>
                    <input type="file" accept="image/jpeg,image/png,image/jpg" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} disabled={uploadMutation.isPending} />
                    <Button size="sm" className="bg-ink hover:bg-ink-muted text-canvas pointer-events-none">{uploadMutation.isPending ? "Uploading…" : "Select Image"}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
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

function SheetPreview({
  createDate,
  periodStart,
  periodEnd,
  sheetAlreadyExists,
  onGenerate,
  isGenerating,
  createError,
}: SheetPreviewProps) {
  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["previewReadings", createDate],
    queryFn: () => inventoryService.getBulkReadingsForm(createDate),
  });

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["previewPayments", createDate],
    queryFn: () =>
      paymentService.getPayments({ payment_date: createDate, page_size: 100 }),
  });

  const { data: dailyVouchers, isLoading: vouchersLoading } = useQuery({
    queryKey: ["previewVouchers", createDate, periodStart, periodEnd],
    queryFn: () =>
      voucherService.getVouchers({
        from_datetime: periodStart,
        to_datetime: periodEnd,
        page_size: 100,
      }),
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

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6 pt-4 border-t border-hairline mt-6">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-surface-2 p-4 rounded-lg border border-hairline">
        <div>
          <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
            <ClipboardList size={16} className="text-fuel-amber" /> Live Sheet Preview
          </h4>
          <p className="text-[10px] text-ink-muted mt-0.5 font-mono">
            Timing: {fmtDt(periodStart)} → {fmtDt(periodEnd)}
          </p>
        </div>
        
        {sheetAlreadyExists ? (
          <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md font-semibold">
            <AlertTriangle size={14} /> Daily sheet already generated for this date
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {createError && (
              <span className="text-xs font-semibold text-red-500">{createError}</span>
            )}
            <Button
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-8 cursor-pointer"
              onClick={onGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate & Save Daily Sheet"}
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Receipt, label: "Total Meter Sales", value: `${totalLitersSold.toLocaleString(undefined, { minimumFractionDigits: 2 })} L`, amber: false },
          { icon: TrendingUp, label: "Total Voucher Sales", value: formatCurrencyIN(totalInvoiceSales), amber: false },
          { icon: Coins, label: "Payments Collected", value: formatCurrencyIN(totalPaymentsCollected), amber: false },
          { icon: PiggyBank, label: "Total Cash Received", value: formatCurrencyIN(totalCashCollected), amber: true },
        ].map(({ icon: Icon, label, value, amber }) => (
          <Card key={label} className={`glass border-hairline ${amber ? "border-fuel-amber bg-fuel-amber/5" : ""}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 flex items-center justify-center rounded-lg ${amber ? "bg-fuel-amber/20 text-fuel-amber" : "bg-fuel-amber/10 text-fuel-amber"}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className={`text-[10px] uppercase font-mono tracking-wider ${amber ? "text-fuel-amber font-bold" : "text-ink-subtle"}`}>{label}</p>
                <p className={`text-base font-black font-mono mt-0.5 ${amber ? "text-fuel-amber" : "text-ink"}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Nozzle Readings */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5 px-1">
          <CheckCircle2 size={14} className="text-fuel-amber" /> Nozzle Readings
        </h3>
        {salesForm?.items && salesForm.items.length > 0 ? (
          <Card className="glass border-hairline p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {salesForm.items.map((item) => {
                const opening = item.opening_reading || 0;
                const closing = item.closing_reading !== null ? item.closing_reading : null;
                const sales = closing !== null && closing >= opening ? closing - opening : null;
                return (
                  <div key={item.nozzle_uuid} className="border border-hairline rounded bg-surface-2 flex flex-col text-center divide-y divide-hairline shadow-sm">
                    <div className="bg-surface-3/50 px-1 py-1 font-bold text-[10px] text-ink flex items-center justify-center gap-1.5">
                      <span className="truncate max-w-[60px]">{item.nozzle_name}</span>
                      <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/10 text-fuel-amber border-transparent font-bold">{item.fuel_type}</Badge>
                    </div>
                    <div className="py-1 px-1.5"><div className="text-[8px] uppercase font-mono text-ink-subtle">Closing</div><div className="text-xs font-bold text-ink mt-0.5 font-mono">{closing !== null ? closing.toFixed(1) : "—"}</div></div>
                    <div className="py-1 px-1.5"><div className="text-[8px] uppercase font-mono text-ink-subtle">Opening</div><div className="text-xs font-bold text-ink-muted mt-0.5 font-mono">{opening.toFixed(1)}</div></div>
                    <div className="py-1 px-1.5 bg-fuel-amber/5"><div className="text-[8px] uppercase font-mono text-fuel-amber font-bold">Liters</div><div className="text-xs font-black text-fuel-amber mt-0.5 font-mono">{sales !== null ? `${sales.toFixed(1)} L` : "—"}</div></div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <Card className="glass border-hairline p-8 text-center text-xs text-ink-subtle italic">No nozzle readings for this date.</Card>
        )}
      </div>

      {/* Vouchers and Payments tables side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vouchers */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
            <FileText size={14} className="text-fuel-amber" /> Vouchers in this period
          </h3>
          <Card className="glass border-hairline overflow-hidden">
            <CardContent className="p-0">
              {dailyVouchers && dailyVouchers.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-hairline hover:bg-transparent">
                        <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Invoice / Customer</TableHead>
                        <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Fuel / Qty</TableHead>
                        <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Mode</TableHead>
                        <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyVouchers.items.map((v) => (
                        <TableRow key={v.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                          <TableCell className="px-3 py-1.5 text-xs">
                            <div className="font-bold text-ink truncate max-w-[120px]">{v.invoice_number}</div>
                            <div className="text-[9px] text-ink-subtle">{v.customer_name || "—"}</div>
                          </TableCell>
                          <TableCell className="py-1.5 text-xs text-ink-muted font-mono">
                            <div>{v.fuel_type}</div>
                            <div className="text-[9px] text-ink-subtle">{Number(v.quantity_liters).toFixed(2)} L</div>
                          </TableCell>
                          <TableCell className="py-1.5 text-xs">
                            <Badge className={`text-[8px] px-1 py-0 uppercase border-transparent font-bold ${v.payment_mode === "CREDIT" ? "bg-red-500/10 text-red-500" : "bg-fuel-amber/15 text-fuel-amber"}`}>{v.payment_mode}</Badge>
                          </TableCell>
                          <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">{formatCurrencyIN(Number(v.total_amount))}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-surface-3/20 hover:bg-surface-3/20">
                        <TableCell colSpan={3} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">Total</TableCell>
                        <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">{formatCurrencyIN(totalInvoiceSales)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-ink-subtle italic">No vouchers saved in this period.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payments */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold px-1 flex items-center gap-1.5">
            <Coins size={14} className="text-fuel-amber" /> Payments
          </h3>
          <Card className="glass border-hairline overflow-hidden">
            <CardContent className="p-0">
              {dailyPayments && dailyPayments.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-hairline hover:bg-transparent">
                        <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Customer</TableHead>
                        <TableHead className="py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Mode</TableHead>
                        <TableHead className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyPayments.items.map((p) => (
                        <TableRow key={p.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                          <TableCell className="px-3 py-1.5 text-xs font-bold text-ink">{p.customer_name}</TableCell>
                          <TableCell className="py-1.5 text-xs">
                            <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/15 text-fuel-amber border-transparent font-bold">{p.payment_mode}</Badge>
                          </TableCell>
                          <TableCell className="px-3 py-1.5 text-right font-bold text-xs text-ink font-mono">{formatCurrencyIN(Number(p.amount))}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-surface-3/20 hover:bg-surface-3/20">
                        <TableCell colSpan={2} className="px-3 py-1 text-[9px] font-bold text-ink text-right uppercase tracking-wider">Total</TableCell>
                        <TableCell className="px-3 py-1 text-right text-xs font-black text-fuel-amber font-mono">{formatCurrencyIN(totalPaymentsCollected)}</TableCell>
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
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DailySheetPage() {
  const queryClient = useQueryClient();

  // ── Create tab state ────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const [createDate, setCreateDate] = useState(today);
  const [useCustomWindow, setUseCustomWindow] = useState(false);

  // ── Default settings state (persisted in localStorage) ──────────────────
  const [defaultStartHour, setDefaultStartHour] = useState(
    () => localStorage.getItem("daily_sheet_default_start_hour") || "12:00"
  );
  const [defaultEndHour, setDefaultEndHour] = useState(
    () => localStorage.getItem("daily_sheet_default_end_hour") || "12:00"
  );
  const [defaultStartOffset, setDefaultStartOffset] = useState(
    () => Number(localStorage.getItem("daily_sheet_default_start_offset") ?? "-1")
  );
  const [defaultEndOffset, setDefaultEndOffset] = useState(
    () => Number(localStorage.getItem("daily_sheet_default_end_offset") ?? "0")
  );
  const [showSettings, setShowSettings] = useState(false);

  const calculateDefaultPeriod = (
    baseDateStr: string,
    startHr: string,
    startOff: number,
    endHr: string,
    endOff: number
  ) => {
    try {
      const [year, month, day] = baseDateStr.split("-").map(Number);
      
      const startDate = new Date(year, month - 1, day);
      startDate.setDate(startDate.getDate() + startOff);
      const [startH, startM] = startHr.split(":").map(Number);
      startDate.setHours(startH, startM, 0, 0);

      const endDate = new Date(year, month - 1, day);
      endDate.setDate(endDate.getDate() + endOff);
      const [endH, endM] = endHr.split(":").map(Number);
      endDate.setHours(endH, endM, 0, 0);

      return {
        start: toDatetimeLocal(startDate),
        end: toDatetimeLocal(endDate),
      };
    } catch (e) {
      return {
        start: baseDateStr + "T12:00",
        end: baseDateStr + "T12:00",
      };
    }
  };

  const defaultStart = (): string => {
    return calculateDefaultPeriod(
      createDate,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    ).start;
  };

  const defaultEnd = (): string => {
    return calculateDefaultPeriod(
      createDate,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    ).end;
  };

  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);

  // Whenever createDate changes, reset the window defaults using current config
  const handleCreateDateChange = (val: string) => {
    setCreateDate(val);
    const p = calculateDefaultPeriod(
      val,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    );
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
  };

  // Check if a sheet already exists for the selected date
  const { data: existingSheet } = useQuery({
    queryKey: ["dailySheet", createDate],
    queryFn: () => dailySheetService.getDailySheet(createDate),
    retry: false,
  });

  const sheetAlreadyExists = Boolean(existingSheet);

  // ── Stored sheets tab state ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"last" | "create" | "stored">("last");
  const [selectedSheet, setSelectedSheet] = useState<DailySheet | null>(null);

  const { data: allSheets, isLoading: sheetsLoading } = useQuery({
    queryKey: ["dailySheets"],
    queryFn: () => dailySheetService.listDailySheets(),
  });

  // ── Create mutation ─────────────────────────────────────────────────────
  const [createError, setCreateError] = useState<string | null>(null);

  const generateSheetMutation = useMutation({
    mutationFn: () =>
      dailySheetService.createDailySheet(createDate, {
        period_start: new Date(periodStart).toISOString(),
        period_end: new Date(periodEnd).toISOString(),
      }),
    onSuccess: (sheet) => {
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      queryClient.invalidateQueries({ queryKey: ["dailySheet", createDate] });
      // Switch to Last Sheet tab
      setSelectedSheet(null);
      setActiveTab("last");
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 409) {
        setCreateError(`A daily sheet for ${new Date(createDate).toLocaleDateString("en-IN", { dateStyle: "long" })} already exists.`);
      } else {
        setCreateError(err?.response?.data?.detail ?? "Failed to generate sheet.");
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Daily Sheet"
        description="Generate time-bound accounting snapshots and access all stored sheets."
      />

      <div>
        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 bg-surface-2 border border-hairline rounded-lg p-1 w-fit no-print">
          <button
            type="button"
            onClick={() => { setActiveTab("last"); setSelectedSheet(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
              activeTab === "last"
                ? "bg-fuel-amber text-canvas shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-surface-3"
            }`}
          >
            <ClipboardList size={13} /> Last Sheet
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("create"); setSelectedSheet(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
              activeTab === "create"
                ? "bg-fuel-amber text-canvas shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-surface-3"
            }`}
          >
            <PlusCircle size={13} /> Create Sheet
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("stored"); setSelectedSheet(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
              activeTab === "stored"
                ? "bg-fuel-amber text-canvas shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-surface-3"
            }`}
          >
            <FolderOpen size={13} /> Stored Sheets
            {allSheets && allSheets.length > 0 && (
              <Badge className="ml-1 text-[8px] px-1.5 py-0 bg-ink/10 text-ink border-transparent font-bold">{allSheets.length}</Badge>
            )}
          </button>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1 — LAST SHEET (CURRENT DAY)
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "last" && <div className="mt-6">
          {sheetsLoading ? (
            <LoadingState />
          ) : allSheets && allSheets.length > 0 ? (
            <SheetDetail
              key={allSheets[0].uuid}
              sheet={allSheets[0]}
              onClose={() => {}}
              hideBackButton={true}
            />
          ) : (
            <Card className="glass border-hairline py-16 flex flex-col items-center text-center max-w-3xl mx-auto">
              <ClipboardList size={40} className="text-ink-subtle mb-4" />
              <h3 className="text-base font-bold text-ink mb-2">No Sheets Generated Yet</h3>
              <p className="text-xs text-ink-muted max-w-sm mb-6 leading-relaxed">
                You haven't generated any daily snapshots yet. Go to the <strong>Create Sheet</strong> tab to generate your first snapshot.
              </p>
              <Button
                onClick={() => setActiveTab("create")}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium text-xs h-8 cursor-pointer"
              >
                Create First Sheet
              </Button>
            </Card>
          )}
        </div>}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — CREATE SHEET
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "create" && <div className="mt-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Date picker card */}
            <Card className="glass border-hairline">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-fuel-amber" />
                    <h3 className="text-sm font-bold text-ink">Select Accounting Date</h3>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 text-ink-muted hover:text-ink hover:bg-surface-3 cursor-pointer no-print"
                    onClick={() => setShowSettings(!showSettings)}
                  >
                    ⚙️ Default Time Settings
                  </Button>
                </div>

                {showSettings && (
                  <div className="border border-hairline rounded-lg p-4 bg-surface-2 space-y-4 text-xs no-print">
                    <div className="flex items-center justify-between border-b border-hairline pb-2 mb-1">
                      <h4 className="font-bold text-ink flex items-center gap-1.5">
                        ⚙️ Default Timing Configuration
                      </h4>
                      <p className="text-[10px] text-ink-subtle">Saved automatically to browser</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Start Time Config */}
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Default Start Window</Label>
                        <div className="flex gap-2">
                          <Input
                            type="time"
                            value={defaultStartHour}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDefaultStartHour(val);
                              localStorage.setItem("daily_sheet_default_start_hour", val);
                              const p = calculateDefaultPeriod(createDate, val, defaultStartOffset, defaultEndHour, defaultEndOffset);
                              setPeriodStart(p.start);
                              setPeriodEnd(p.end);
                            }}
                            className="bg-surface-1 border-hairline text-xs h-8 flex-1"
                          />
                          <select
                            value={defaultStartOffset}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDefaultStartOffset(val);
                              localStorage.setItem("daily_sheet_default_start_offset", String(val));
                              const p = calculateDefaultPeriod(createDate, defaultStartHour, val, defaultEndHour, defaultEndOffset);
                              setPeriodStart(p.start);
                              setPeriodEnd(p.end);
                            }}
                            className="bg-surface-1 border border-hairline rounded-md text-xs px-2 h-8 text-ink focus:outline-none"
                          >
                            <option value="-1">Prev Day</option>
                            <option value="0">Selected Day</option>
                          </select>
                        </div>
                      </div>

                      {/* End Time Config */}
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-mono text-ink-subtle font-bold">Default End Window</Label>
                        <div className="flex gap-2">
                          <Input
                            type="time"
                            value={defaultEndHour}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDefaultEndHour(val);
                              localStorage.setItem("daily_sheet_default_end_hour", val);
                              const p = calculateDefaultPeriod(createDate, defaultStartHour, defaultStartOffset, val, defaultEndOffset);
                              setPeriodStart(p.start);
                              setPeriodEnd(p.end);
                            }}
                            className="bg-surface-1 border-hairline text-xs h-8 flex-1"
                          />
                          <select
                            value={defaultEndOffset}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDefaultEndOffset(val);
                              localStorage.setItem("daily_sheet_default_end_offset", String(val));
                              const p = calculateDefaultPeriod(createDate, defaultStartHour, defaultStartOffset, defaultEndHour, val);
                              setPeriodStart(p.start);
                              setPeriodEnd(p.end);
                            }}
                            className="bg-surface-1 border border-hairline rounded-md text-xs px-2 h-8 text-ink focus:outline-none"
                          >
                            <option value="0">Selected Day</option>
                            <option value="1">Next Day</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-ink-subtle italic">
                      Changing these settings updates the default window calculation. By default, it is configured for 12:00 PM (noon) to 12:00 PM (noon) the following day.
                    </p>
                  </div>
                )}

                {/* Date row */}
                <div className="space-y-1.5">
                  <Label htmlFor="createDateInput" className="text-xs font-semibold text-ink-muted">
                    Date
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const d = new Date(createDate);
                        d.setDate(d.getDate() - 1);
                        handleCreateDateChange(d.toISOString().split("T")[0]);
                      }}
                      className="h-9 w-9 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer shrink-0"
                      title="Previous Day"
                    >
                      ←
                    </Button>
                    <Input
                      id="createDateInput"
                      type="date"
                      value={createDate}
                      onChange={(e) => handleCreateDateChange(e.target.value)}
                      className="bg-surface-2 border-hairline text-sm text-ink h-9 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const d = new Date(createDate);
                        d.setDate(d.getDate() + 1);
                        handleCreateDateChange(d.toISOString().split("T")[0]);
                      }}
                      className="h-9 w-9 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer shrink-0"
                      title="Next Day"
                    >
                      →
                    </Button>
                  </div>
                </div>

                {/* Custom time window toggle */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                    <div
                      onClick={() => {
                        setUseCustomWindow((v) => !v);
                        if (!useCustomWindow) {
                          setPeriodStart(defaultStart());
                          setPeriodEnd(defaultEnd());
                        }
                      }}
                      className={`h-5 w-9 rounded-full transition-colors cursor-pointer relative ${useCustomWindow ? "bg-fuel-amber" : "bg-surface-3"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-canvas shadow transition-transform ${useCustomWindow ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink flex items-center gap-1.5">
                        <Clock size={11} className="text-fuel-amber" /> Custom Time Window
                      </p>
                      <p className="text-[10px] text-ink-subtle mt-0.5">
                        e.g. 14 Jul 8 PM → 15 Jul 8 PM
                      </p>
                    </div>
                  </label>

                  {useCustomWindow && (
                    <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-fuel-amber/30">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-mono text-ink-subtle">Period Start</Label>
                        <Input
                          type="datetime-local"
                          value={periodStart}
                          onChange={(e) => setPeriodStart(e.target.value)}
                          className="bg-surface-2 border-hairline text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-mono text-ink-subtle">Period End</Label>
                        <Input
                          type="datetime-local"
                          value={periodEnd}
                          onChange={(e) => setPeriodEnd(e.target.value)}
                          className="bg-surface-2 border-hairline text-xs h-8"
                        />
                      </div>
                      <p className="col-span-2 text-[10px] text-ink-subtle italic">
                        Only vouchers saved between these two times will appear on this sheet.
                      </p>
                    </div>
                  )}

                  {!useCustomWindow && (
                    <p className="text-[10px] text-ink-subtle italic pl-1">
                      Default window: <strong>{fmtDt(periodStart)}</strong> → <strong>{fmtDt(periodEnd)}</strong>. Only vouchers saved in this period will be included.
                    </p>
                  )}
                </div>

                {/* Existing sheet warning */}
                {sheetAlreadyExists && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                    <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-600">Sheet already exists</p>
                      <p className="text-[10px] text-amber-700 mt-0.5">
                        A sheet for this date has already been generated. You can view or edit it in the{" "}
                        <button
                          className="underline font-semibold cursor-pointer"
                          onClick={() => setActiveTab("stored")}
                        >
                          Stored Sheets
                        </button>{" "}
                        tab.
                      </p>
                    </div>
                  </div>
                )}

                {/* Error from creation */}
                {createError && !sheetAlreadyExists && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600">{createError}</p>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Info card */}
            <Card className="border-hairline bg-surface-2/40">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-bold text-ink-muted uppercase tracking-wider font-mono">How it works</p>
                <ul className="text-xs text-ink-muted space-y-1.5 list-none">
                  <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">①</span> Select the accounting date and optional custom time window.</li>
                  <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">②</span> Review the <strong>Live Sheet Preview</strong> generated below.</li>
                  <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">③</span> If satisfied, click <strong>Generate & Save Daily Sheet</strong> in the preview banner.</li>
                  <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">④</span> Stored sheets are persisted and can be viewed or updated in the <strong>Stored Sheets</strong> tab.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Live Sheet Preview */}
            <SheetPreview
              createDate={createDate}
              periodStart={periodStart}
              periodEnd={periodEnd}
              sheetAlreadyExists={sheetAlreadyExists}
              onGenerate={() => { setCreateError(null); generateSheetMutation.mutate(); }}
              isGenerating={generateSheetMutation.isPending}
              createError={createError}
            />
          </div>
        </div>}

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — STORED SHEETS
        ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "stored" && <div className="mt-6">
          {selectedSheet ? (
            <SheetDetail
              key={selectedSheet.uuid}
              sheet={selectedSheet}
              onClose={() => setSelectedSheet(null)}
            />
          ) : (
            <div className="space-y-4">
              {sheetsLoading ? (
                <LoadingState />
              ) : !allSheets || allSheets.length === 0 ? (
                <Card className="glass border-hairline py-16 flex flex-col items-center text-center">
                  <FolderOpen size={40} className="text-ink-subtle mb-4" />
                  <h3 className="text-base font-bold text-ink mb-2">No Sheets Generated Yet</h3>
                  <p className="text-sm text-ink-muted mb-5">
                    Go to the <strong>Create Sheet</strong> tab to generate your first daily sheet.
                  </p>
                  <Button
                    onClick={() => setActiveTab("create")}
                    className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold cursor-pointer"
                  >
                    <PlusCircle size={14} className="mr-1.5" /> Create First Sheet
                  </Button>
                </Card>
              ) : (
                <>
                  <p className="text-xs text-ink-muted px-1">
                    {allSheets.length} sheet{allSheets.length !== 1 ? "s" : ""} · Click any row to view details
                  </p>
                  <Card className="glass border-hairline overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-hairline hover:bg-transparent">
                          <TableHead className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Date</TableHead>
                          <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Period Start</TableHead>
                          <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Period End</TableHead>
                          <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Remarks</TableHead>
                          <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Scan</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSheets.map((sheet) => (
                          <TableRow
                            key={sheet.uuid}
                            className="border-b border-hairline hover:bg-surface-3/20 cursor-pointer transition-colors"
                            onClick={() => setSelectedSheet(sheet)}
                          >
                            <TableCell className="px-4 py-3">
                              <div className="font-bold text-sm text-ink">
                                {new Date(sheet.date).toLocaleDateString("en-IN", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </div>
                              <div className="text-[9px] text-ink-subtle font-mono mt-0.5">
                                Generated: {fmtDt(sheet.created_at)}
                              </div>
                            </TableCell>
                            <TableCell className="py-3 text-xs text-ink-muted font-mono whitespace-nowrap">
                              {fmtDt(sheet.period_start)}
                            </TableCell>
                            <TableCell className="py-3 text-xs text-fuel-amber font-mono font-semibold whitespace-nowrap">
                              {fmtDt(sheet.period_end)}
                            </TableCell>
                            <TableCell className="py-3 max-w-[160px]">
                              {sheet.remarks ? (
                                <span className="text-xs text-ink truncate block">{sheet.remarks}</span>
                              ) : (
                                <span className="text-xs text-ink-subtle italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3">
                              {sheet.manual_sheet_image ? (
                                <Badge className="text-[8px] px-1.5 py-0 bg-green-500/10 text-green-600 border-transparent font-bold">Uploaded</Badge>
                              ) : (
                                <span className="text-[10px] text-ink-subtle">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-3 pr-4 text-right">
                              <ChevronRight size={14} className="text-ink-subtle" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
