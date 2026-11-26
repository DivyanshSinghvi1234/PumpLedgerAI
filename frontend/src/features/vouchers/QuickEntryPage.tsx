import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Camera, Fuel, CheckCircle2, Moon, AlertTriangle, CloudOff, Hand, Calculator } from "lucide-react";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import { usePreferences } from "@/lib/preferences";
import { evalMathExpression, formatVehiclePlate, numberToIndianWords, playSaveChime } from "@/lib/formatters";

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
import { useLanguage } from "@/i18n/LanguageContext";
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
  const { t } = useLanguage();
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
  const { soundEnabled, leftHanded, setLeftHanded } = usePreferences();
  const [upiUuid, setUpiUuid] = useState("");
  const [bankUuid, setBankUuid] = useState("");
  const [scheduledRate, setScheduledRate] = useState<number | null>(null);
  const [entryFocus, setEntryFocus] = useState<"AMOUNT" | "LITERS">("AMOUNT");
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem("pumpledger_offline_slips");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Auto-sync offline slips when back online
  useEffect(() => {
    const syncQueue = async () => {
      const raw = localStorage.getItem("pumpledger_offline_slips");
      const items: any[] = raw ? JSON.parse(raw) : [];
      if (items.length === 0 || !navigator.onLine) return;
      const remaining: any[] = [];
      for (const item of items) {
        try {
          await voucherService.createVoucher(item);
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem("pumpledger_offline_slips", JSON.stringify(remaining));
      setOfflineQueue(remaining);
      if (remaining.length < items.length) {
        toast.success(`Synced ${items.length - remaining.length} offline slip(s)!`);
        queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      }
    };
    window.addEventListener("online", syncQueue);
    syncQueue();
    return () => window.removeEventListener("online", syncQueue);
  }, []);

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
    mutationFn: async () => {
      const qty = parseFloat(liters);
      const r = parseFloat(rate);
      const tot = evalMathExpression(totalAmount) ?? parseFloat(totalAmount);
      const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
      const rand = Math.floor(100 + Math.random() * 900);
      const payload = {
        invoice_number: `QE-${businessDate.replace(/-/g, "")}-${stamp}${rand}`,
        invoice_date: businessDate,
        fuel_type: fuelType,
        payment_mode: paymentMode,
        quantity_liters: qty,
        rate_per_liter: r,
        total_amount: tot,
        customer_uuid: customerUuid || undefined,
        customer_name: customerName.trim() || undefined,
        vehicle_number: vehicleNumber.trim() ? formatVehiclePlate(vehicleNumber.trim()) : undefined,
        bank_account_uuid: paymentMode === "UPI" && bankUuid ? bankUuid : undefined,
      };
      if (!navigator.onLine) {
        const nextQ = [...offlineQueue, payload];
        localStorage.setItem("pumpledger_offline_slips", JSON.stringify(nextQ));
        setOfflineQueue(nextQ);
        return { ...payload, uuid: "", __offline: true } as any;
      }
      try {
        return await voucherService.createVoucher(payload);
      } catch (err: any) {
        if (!err?.response) {
          const nextQ = [...offlineQueue, payload];
          localStorage.setItem("pumpledger_offline_slips", JSON.stringify(nextQ));
          setOfflineQueue(nextQ);
          return { ...payload, uuid: "", __offline: true } as any;
        }
        throw err;
      }
    },
    onSuccess: (created) => {
      playSaveChime(soundEnabled);
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 700);
      if (vehicleNumber.trim()) {
        try {
          const map = JSON.parse(localStorage.getItem("vehicle_fuel_map") || "{}");
          map[formatVehiclePlate(vehicleNumber.trim())] = fuelType;
          localStorage.setItem("vehicle_fuel_map", JSON.stringify(map));
        } catch { /* ignore */ }
      }
      if ((created as any)?.__offline) {
        toast.info("Offline: Slip queued and will auto-sync when online.");
      } else {
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
      }
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
        title={t("Quick Entry Mode")}
        description={t("Fast forecourt screen for attendants: create a credit/cash/UPI slip and check today's nozzle totals.")}
        helpText="Pick Fuel Type, Customer/Vehicle, enter Amount or Liters, and tap Save Slip. Designed for mobile & tablet use at the island."
        action={
          <Link to="/dashboard/upload">
            <Button variant="outline" className="text-xs h-9 border-hairline cursor-pointer">
              <Camera size={14} className="mr-1.5 text-fuel-amber" /> {t("Snap Bill Photo")}
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Quick Slip Form */}
        <Card className={`glass border-hairline lg:col-span-7 transition-all ${saveFlash ? "ring-2 ring-emerald-500 bg-emerald-500/5" : ""} ${leftHanded ? "lg:order-2" : ""}`}>
          <CardHeader className="pb-3 border-b border-hairline flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
              <Zap size={16} className="text-fuel-amber" /> New Forecourt Slip
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {offlineQueue.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                  <CloudOff size={10} /> {offlineQueue.length} waiting
                </span>
              )}
              <button
                type="button"
                onClick={() => setKeypadOpen((v) => !v)}
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold cursor-pointer ${keypadOpen ? "bg-fuel-amber text-canvas border-fuel-amber" : "bg-surface-2 text-ink-muted border-hairline"}`}
                title="Toggle Large Numeric Keypad"
              >
                <Calculator size={11} className="inline mr-1" />Keypad
              </button>
              <button
                type="button"
                onClick={() => setLeftHanded(!leftHanded)}
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold cursor-pointer ${leftHanded ? "bg-indigo-500/20 text-indigo-300 border-indigo-400" : "bg-surface-2 text-ink-muted border-hairline"}`}
                title="Flip Left/Right-Handed Layout"
              >
                <Hand size={11} className="inline mr-1" />{leftHanded ? "Left" : "Right"}
              </button>
            </div>
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
                    const formatted = formatVehiclePlate(num);
                    setVehicleNumber(formatted);
                    try {
                      const map = JSON.parse(localStorage.getItem("vehicle_fuel_map") || "{}");
                      if (map[formatted]) setFuelType(map[formatted]);
                    } catch { /* ignore */ }
                    if (vehicle) {
                      setCustomerName(vehicle.customer_name);
                      setCustomerUuid(vehicle.customer_uuid);
                    }
                  }}
                />
              </div>

              {/* Exact Amount vs Round Liters Toggle + Preset Chips */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-hairline bg-surface-2 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setEntryFocus("AMOUNT")}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${entryFocus === "AMOUNT" ? "bg-fuel-amber text-canvas" : "text-ink-muted"}`}
                  >
                    Exact Amount (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryFocus("LITERS")}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${entryFocus === "LITERS" ? "bg-fuel-amber text-canvas" : "text-ink-muted"}`}
                  >
                    Round Liters (L)
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["500", "1000", "2000", "5000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAmountChange(preset)}
                      className="rounded-md border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-mono font-semibold text-ink hover:bg-surface-3 cursor-pointer"
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount / Liters / Rate */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-ink-muted">Amount (₹)</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 2000 or 500+1200"
                    value={totalAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onBlur={() => {
                      const evaluated = evalMathExpression(totalAmount);
                      if (evaluated !== null && evaluated > 0) {
                        handleAmountChange(String(evaluated));
                      }
                    }}
                    className="h-12 text-sm font-mono font-bold"
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
                    className="h-12 text-sm font-mono font-bold"
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
                    className="h-12 text-sm font-mono"
                    required
                  />
                </div>
              </div>

              {Number(totalAmount) > 0 && (
                <div className="text-[11px] text-ink-muted italic">
                  {numberToIndianWords(Number(totalAmount))}
                </div>
              )}

              {/* Large Thumb-Friendly Numeric Keypad */}
              {keypadOpen && (
                <div className="grid grid-cols-4 gap-2 rounded-xl border border-hairline bg-surface-2 p-2.5">
                  {["7", "8", "9", "⌫", "4", "5", "6", "C", "1", "2", "3", ".", "0", "00"].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        const setter = entryFocus === "AMOUNT" ? handleAmountChange : handleLitersChange;
                        const cur = entryFocus === "AMOUNT" ? totalAmount : liters;
                        if (k === "C") setter("");
                        else if (k === "⌫") setter(cur.slice(0, -1));
                        else setter(cur + k);
                      }}
                      className="h-11 rounded-lg border border-hairline bg-surface-1 font-mono text-sm font-bold text-ink hover:bg-surface-3 cursor-pointer"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

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
