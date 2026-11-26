import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Camera, Fuel, CheckCircle2, Moon, AlertTriangle } from "lucide-react";
import BankAccountSelect from "@/components/common/BankAccountSelect";

import PageHeader from "@/components/common/PageHeader";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import VehicleAutocomplete from "@/features/vehicles/components/VehicleAutocomplete";
import UpiAccountSelect from "@/components/common/UpiAccountSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import voucherService from "@/features/vouchers/services/voucherService";
import inventoryService from "@/features/inventory/services/inventoryService";
import { useVoucherList } from "@/features/vouchers/hooks/useVoucherList";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import type { FuelType, PaymentMode } from "@/types/voucher";

const FUEL_BUTTONS: { label: string; value: FuelType }[] = [
  { label: "Diesel", value: "DIESEL" },
  { label: "Petrol", value: "PETROL" },
  { label: "Speed", value: "SPEED" },
];

const MODE_BUTTONS: { label: string; value: PaymentMode }[] = [
  { label: "Credit", value: "CREDIT" },
  { label: "Cash", value: "CASH" },
  { label: "UPI", value: "UPI" },
];

export default function QuickEntryPage() {
  const today = getTodayDateString();
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);
  const isAfterMidnightShift = new Date().getHours() < 6;
  const queryClient = useQueryClient();

  const [assignYesterday, setAssignYesterday] = useState(isAfterMidnightShift);
  const businessDate = assignYesterday ? yesterday : today;

  const [fuelType, setFuelType] = useState<FuelType>("DIESEL");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CREDIT");
  const [customerName, setCustomerName] = useState("");
  const [customerUuid, setCustomerUuid] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [liters, setLiters] = useState("");
  const [rate, setRate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [upiUuid, setUpiUuid] = useState("");
  const [bankUuid, setBankUuid] = useState("");
  const [scheduledRate, setScheduledRate] = useState<number | null>(null);

  const { data: schedules } = useQuery({
    queryKey: ["priceSchedules"],
    queryFn: () => inventoryService.getPriceSchedules(),
    staleTime: 60_000,
  });

  const { data: nozzleForm } = useQuery({
    queryKey: ["nozzleReadingsBulkForm", today],
    queryFn: () => inventoryService.getBulkReadingsForm(today),
  });

  const { data: recentVouchers } = useVoucherList({
    from_date: today,
    to_date: today,
    page: 1,
    page_size: 8,
  });

  // Auto-fill current fuel rate when fuelType or schedules load
  useEffect(() => {
    const active = schedules?.find(
      (s) => s.fuel_type === fuelType && s.is_applied
    );
    if (active) {
      setRate(String(active.rate));
      setScheduledRate(Number(active.rate));
    }
  }, [fuelType, schedules]);

  // Sanity warnings
  const rateDiffWarning = useMemo(() => {
    const r = parseFloat(rate);
    if (!scheduledRate || isNaN(r) || r <= 0) return null;
    const diff = Math.abs(r - scheduledRate);
    if (diff > 2) {
      return `Entered rate ₹${r.toFixed(2)} differs from today's schedule (₹${scheduledRate.toFixed(2)}) by ₹${diff.toFixed(2)}/L.`;
    }
    return null;
  }, [rate, scheduledRate]);

  const mathMismatchWarning = useMemo(() => {
    const l = parseFloat(liters);
    const r = parseFloat(rate);
    const t = parseFloat(totalAmount);
    if (isNaN(l) || isNaN(r) || isNaN(t) || l <= 0 || r <= 0 || t <= 0) return null;
    const expected = l * r;
    if (Math.abs(expected - t) > 1.5) {
      return `Qty × Rate = ₹${expected.toFixed(2)}, but Total is ₹${t.toFixed(2)}.`;
    }
    return null;
  }, [liters, rate, totalAmount]);

  const handleLitersChange = (val: string) => {
    setLiters(val);
    const l = parseFloat(val);
    const r = parseFloat(rate);
    if (!isNaN(l) && !isNaN(r) && r > 0) {
      setTotalAmount((l * r).toFixed(2));
    }
  };

  const handleAmountChange = (val: string) => {
    setTotalAmount(val);
    const a = parseFloat(val);
    const r = parseFloat(rate);
    if (!isNaN(a) && !isNaN(r) && r > 0) {
      setLiters((a / r).toFixed(2));
    }
  };

  const nozzleSummary = useMemo(() => {
    const items = nozzleForm?.items ?? [];
    const byFuel: Record<string, number> = {};
    for (const n of items) {
      const open = Number(n.opening_reading ?? 0);
      const close = Number(n.closing_reading ?? open);
      const test = Number(n.testing ?? 0);
      const net = Math.max(0, close - open - test);
      byFuel[n.fuel_type] = (byFuel[n.fuel_type] || 0) + net;
    }
    return Object.entries(byFuel);
  }, [nozzleForm]);

  const createMutation = useMutation({
    mutationFn: () => {
      const qty = parseFloat(liters);
      const r = parseFloat(rate);
      const tot = parseFloat(totalAmount);
      const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
      const rand = Math.floor(100 + Math.random() * 900);
      return voucherService.createVoucher({
        invoice_number: `QE-${businessDate.replace(/-/g, "")}-${stamp}${rand}`,
        invoice_date: businessDate,
        fuel_type: fuelType,
        payment_mode: paymentMode,
        quantity_liters: qty,
        rate_per_liter: r,
        total_amount: tot,
        customer_uuid: customerUuid || undefined,
        customer_name: customerName.trim() || undefined,
        vehicle_number: vehicleNumber.trim() || undefined,
        bank_account_uuid: paymentMode === "UPI" && bankUuid ? bankUuid : undefined,
      });
    },
    onSuccess: (created) => {
      toast.success("Slip saved! Ready for next vehicle.", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await voucherService.deleteVoucher(created.uuid);
              toast.info("Slip undone and removed.");
              queryClient.invalidateQueries({ queryKey: ["vouchers"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              queryClient.invalidateQueries({ queryKey: ["customers"] });
            } catch {
              toast.error("Could not undo slip (may require Manager/Admin).");
            }
          },
        },
      });
      setLiters("");
      setTotalAmount("");
      setVehicleNumber("");
      setCustomerName("");
      setCustomerUuid("");
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to save quick slip.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(liters);
    const tot = parseFloat(totalAmount);
    if (isNaN(qty) || qty <= 0 || isNaN(tot) || tot <= 0) {
      toast.error("Enter valid liters or amount.");
      return;
    }
    if (paymentMode === "CREDIT" && !customerUuid && !customerName.trim()) {
      toast.error("Please select a Customer for Credit slips.");
      return;
    }
    if (paymentMode === "UPI" && !bankUuid) {
      toast.error("Please select a UPI Handle or Linked Bank Account.");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quick Entry Mode"
        description="Fast forecourt screen for attendants: create a credit/cash/UPI slip and check today's nozzle totals."
        helpText="Pick Fuel Type, Customer/Vehicle, enter Amount or Liters, and tap Save Slip. Designed for mobile & tablet use at the island."
        action={
          <Link to="/dashboard/upload">
            <Button variant="outline" className="text-xs h-9 border-hairline cursor-pointer">
              <Camera size={14} className="mr-1.5 text-fuel-amber" /> Snap Bill Photo
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Slip Form */}
        <Card className="glass border-hairline lg:col-span-7">
          <CardHeader className="pb-3 border-b border-hairline">
            <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
              <Zap size={16} className="text-fuel-amber" /> New Forecourt Slip
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !createMutation.isPending) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
              className="space-y-4"
            >
              {/* Night-Shift Business Date Toggle (12 AM - 6 AM) */}
              <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Moon size={14} className="text-indigo-400" />
                  <span className="font-medium text-ink">
                    Business Date: <strong className="font-mono">{businessDate}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignYesterday((v) => !v)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                    assignYesterday
                      ? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
                      : "bg-surface-1 border-hairline text-ink-muted hover:text-ink"
                  }`}
                >
                  {assignYesterday ? "Assigned to Yesterday (Night Shift)" : "Assign to Yesterday (12–6 AM)"}
                </button>
              </div>
              {/* Fuel Pills */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">1. Fuel Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FUEL_BUTTONS.map((btn) => (
                    <button
                      key={btn.value}
                      type="button"
                      onClick={() => setFuelType(btn.value)}
                      className={`h-11 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        fuelType === btn.value
                          ? "bg-fuel-amber text-canvas border-fuel-amber shadow-md"
                          : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Mode Pills */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">2. Payment Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MODE_BUTTONS.map((btn) => (
                    <button
                      key={btn.value}
                      type="button"
                      onClick={() => setPaymentMode(btn.value)}
                      className={`h-10 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        paymentMode === btn.value
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                          : "bg-surface-2 text-ink-muted border-hairline hover:text-ink"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === "UPI" && (
                <div className="space-y-2">
                  <UpiAccountSelect
                    value={upiUuid}
                    onChange={(u, linkedBank) => {
                      setUpiUuid(u);
                      if (linkedBank) setBankUuid(linkedBank);
                    }}
                  />
                  {!bankUuid && (
                    <BankAccountSelect
                      value={bankUuid}
                      onChange={setBankUuid}
                      label="Linked Bank Account (Required for UPI)"
                    />
                  )}
                </div>
              )}

              {(rateDiffWarning || mathMismatchWarning) && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                  {rateDiffWarning && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{rateDiffWarning}</span>
                    </div>
                  )}
                  {mathMismatchWarning && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{mathMismatchWarning}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Customer & Vehicle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CustomerAutocomplete
                  value={customerName}
                  customerUuid={customerUuid || null}
                  onChange={(name, uuid) => {
                    setCustomerName(name);
                    setCustomerUuid(uuid ?? "");
                  }}
                />
                <VehicleAutocomplete
                  value={vehicleNumber}
                  onChange={(num, vehicle) => {
                    setVehicleNumber(num);
                    if (vehicle) {
                      setCustomerName(vehicle.customer_name);
                      setCustomerUuid(vehicle.customer_uuid);
                    }
                  }}
                />
              </div>

              {/* Amount / Liters / Rate */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-ink-muted">Amount (₹)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 2000"
                    value={totalAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-11 text-sm font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-ink-muted">Liters</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 20.5"
                    value={liters}
                    onChange={(e) => handleLitersChange(e.target.value)}
                    className="h-11 text-sm font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-ink-muted">Rate (₹/L)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="h-11 text-sm font-mono"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full h-12 bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-sm cursor-pointer shadow-lg"
              >
                <CheckCircle2 size={16} className="mr-2" />
                {createMutation.isPending ? "Saving Slip..." : "Save Slip"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: Today's Nozzle Totals & Recent Slips */}
        <div className="space-y-4 lg:col-span-5">
          <Card className="glass border-hairline">
            <CardHeader className="pb-2 border-b border-hairline">
              <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
                <Fuel size={16} className="text-fuel-amber" /> Today&apos;s Nozzle Totals
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {nozzleSummary.length === 0 ? (
                <p className="text-xs text-ink-subtle italic">No nozzle readings entered for today yet.</p>
              ) : (
                nozzleSummary.map(([ft, vol]) => (
                  <div key={ft} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-xs">
                    <span className="font-bold text-ink">{ft}</span>
                    <span className="font-mono font-bold text-fuel-amber">{vol.toFixed(2)} L</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass border-hairline">
            <CardHeader className="pb-2 border-b border-hairline">
              <CardTitle className="text-sm font-bold text-ink">Today&apos;s Recent Slips</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
              {!recentVouchers?.items || recentVouchers.items.length === 0 ? (
                <p className="text-xs text-ink-subtle italic">No slips recorded today yet.</p>
              ) : (
                recentVouchers.items.map((v) => (
                  <div
                    key={v.uuid}
                    className="flex items-center justify-between rounded-lg border border-hairline bg-surface-2/60 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink truncate">
                        {v.customer_name || "Walk-in"}
                        {v.vehicle_number ? ` · ${v.vehicle_number}` : ""}
                      </p>
                      <p className="text-[10px] font-mono text-ink-subtle">
                        {v.fuel_type} · {Number(v.quantity_liters).toFixed(1)} L
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-mono font-bold text-ink">{formatCurrency(v.total_amount)}</p>
                      <Badge className="text-[9px] bg-surface-3 text-ink-muted border-transparent">
                        {v.payment_mode}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
