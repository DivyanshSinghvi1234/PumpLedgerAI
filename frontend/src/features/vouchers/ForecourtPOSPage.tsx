import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Delete,
  Fuel,
  Maximize2,
  Minimize2,
  Printer,
  QrCode,
  Receipt,
  Sparkles,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CustomerAutocomplete from "@/features/customers/components/CustomerAutocomplete";
import UpiAccountSelect from "@/components/common/UpiAccountSelect";
import inventoryService from "@/features/inventory/services/inventoryService";
import voucherService from "./services/voucherService";
import { useVoucherList } from "./hooks/useVoucherList";
import { usePreferences } from "@/lib/preferences";
import { formatVehiclePlate, numberToIndianWords, playSaveChime } from "@/lib/formatters";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import type { FuelType, PaymentMode } from "@/types/voucher";

const FUEL_TILES: {
  value: FuelType;
  label: string;
  sub: string;
  activeClass: string;
}[] = [
  {
    value: "DIESEL",
    label: "HSD Diesel",
    sub: "Commercial & Fleet",
    activeClass: "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-300 shadow-md",
  },
  {
    value: "PETROL",
    label: "MS Petrol",
    sub: "2W / 4W Regular",
    activeClass: "border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-300 shadow-md",
  },
  {
    value: "SPEED",
    label: "Speed 95",
    sub: "High Octane",
    activeClass: "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 shadow-md",
  },
];

const PAYMENT_TILES: { value: PaymentMode; label: string; icon: typeof Banknote }[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI / QR", icon: QrCode },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "CREDIT", label: "Credit", icon: UserCheck },
];

const AMOUNT_PRESETS = [200, 500, 1000, 2000, 5000, 10000];
const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "BACK"];

export default function ForecourtPOSPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { focusMode, setFocusMode, soundEnabled } = usePreferences();
  const today = getTodayDateString();

  const initialFuel = (searchParams.get("fuel") as FuelType) || "DIESEL";
  const [fuelType, setFuelType] = useState<FuelType>(
    ["PETROL", "DIESEL", "SPEED"].includes(initialFuel) ? initialFuel : "DIESEL"
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [amountStr, setAmountStr] = useState("1000");
  const [customerName, setCustomerName] = useState("");
  const [customerUuid, setCustomerUuid] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [upiAccountUuid, setUpiAccountUuid] = useState("");
  const [upiLinkedBankUuid, setUpiLinkedBankUuid] = useState("");
  const [lastIssuedId, setLastIssuedId] = useState<string | null>(null);

  // Fetch active rates for all 3 grades
  const { data: petrolRateData } = useQuery({
    queryKey: ["active-rate", "PETROL"],
    queryFn: () => inventoryService.getActiveRate("PETROL"),
  });
  const { data: dieselRateData } = useQuery({
    queryKey: ["active-rate", "DIESEL"],
    queryFn: () => inventoryService.getActiveRate("DIESEL"),
  });
  const { data: speedRateData } = useQuery({
    queryKey: ["active-rate", "SPEED"],
    queryFn: () => inventoryService.getActiveRate("SPEED"),
  });

  const rates: Record<FuelType, number> = useMemo(
    () => ({
      PETROL: petrolRateData?.rate ?? 96.5,
      DIESEL: dieselRateData?.rate ?? 89.2,
      SPEED: speedRateData?.rate ?? 103.4,
      LUBRICANT: 0,
    }),
    [petrolRateData, dieselRateData, speedRateData]
  );

  const activeRate = rates[fuelType] || 0;
  const numericAmount = Number(amountStr) || 0;
  const calculatedLiters = activeRate > 0 ? numericAmount / activeRate : 0;

  const { data: recentData } = useVoucherList({
    page: 1,
    page_size: 5,
    from_date: today,
    to_date: today,
  });

  useEffect(() => {
    const paramFuel = searchParams.get("fuel") as FuelType | null;
    if (paramFuel && ["PETROL", "DIESEL", "SPEED"].includes(paramFuel)) {
      setFuelType(paramFuel);
    }
  }, [searchParams]);

  const handleKeyPress = (key: string) => {
    if (key === "BACK") {
      setAmountStr((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
      return;
    }
    if (key === ".") {
      setAmountStr((prev) => (prev.includes(".") ? prev : `${prev}.`));
      return;
    }
    setAmountStr((prev) => (prev === "0" ? key : `${prev}${key}`));
  };

  const issueSlipMutation = useMutation({
    mutationFn: async () => {
      if (numericAmount <= 0) throw new Error("Enter a valid amount");
      if (paymentMode === "CREDIT" && !customerName.trim()) {
        throw new Error("Select or enter a customer for Credit slip");
      }
      const invoiceNo = `POS-${Date.now().toString().slice(-6)}`;
      return voucherService.createVoucher({
        invoice_number: invoiceNo,
        invoice_date: today,
        fuel_type: fuelType,
        quantity_liters: Number(calculatedLiters.toFixed(2)),
        rate_per_liter: activeRate,
        total_amount: Number(numericAmount.toFixed(2)),
        payment_mode: paymentMode,
        customer_name: customerName.trim() || null,
        customer_uuid: customerUuid,
        vehicle_number: vehicleNumber.trim() || null,
        bank_account_uuid: paymentMode === "UPI" && upiLinkedBankUuid ? upiLinkedBankUuid : null,
      });
    },
    onSuccess: (created) => {
      if (soundEnabled) playSaveChime();
      setLastIssuedId(created.invoice_number);
      toast.success(`Slip ${created.invoice_number} issued (${formatCurrency(created.total_amount)})`);
      setVehicleNumber("");
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", today] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to issue slip");
    },
  });

  return (
    <div className="space-y-4">
      {/* Kiosk Header Bar */}
      <div className="bento-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-fuel-orange text-white">
            <Fuel size={18} />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-ink">
              Forecourt POS Kiosk
            </h1>
            <p className="text-[11px] text-ink-muted">
              Touch-first attendant billing · Live rates synced
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFocusMode(!focusMode)}
          >
            {focusMode ? (
              <>
                <Minimize2 size={14} className="mr-1.5" /> Exit Kiosk Fullscreen
              </>
            ) : (
              <>
                <Maximize2 size={14} className="mr-1.5" /> Fullscreen Kiosk
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main 2-Column POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Touch Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Fuel Grade Selector */}
          <div className="grid grid-cols-3 gap-3">
            {FUEL_TILES.map((ft) => {
              const selected = fuelType === ft.value;
              return (
                <button
                  key={ft.value}
                  type="button"
                  onClick={() => setFuelType(ft.value)}
                  className={`rounded-2xl border-2 p-4 text-left transition-all cursor-pointer ${
                    selected
                      ? ft.activeClass
                      : "border-hairline bg-surface-1 hover:border-hairline-strong"
                  }`}
                >
                  <p className="text-sm font-extrabold">{ft.label}</p>
                  <p className="text-[11px] opacity-75">{ft.sub}</p>
                  <p className="mt-2 text-xs font-mono font-bold tabular-nums">
                    ₹{rates[ft.value].toFixed(2)} / L
                  </p>
                </button>
              );
            })}
          </div>

          {/* Preset Amounts + Display */}
          <div className="bento-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  Sale Amount (₹)
                </p>
                <p className="text-3xl font-black text-ink tabular-nums">
                  ₹{Number(amountStr || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                  Volume
                </p>
                <p className="text-xl font-extrabold text-emerald-500 tabular-nums">
                  {calculatedLiters.toFixed(2)} L
                </p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {AMOUNT_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountStr(String(amt))}
                  className={`rounded-xl border py-2.5 text-xs font-bold tabular-nums transition cursor-pointer ${
                    Number(amountStr) === amt
                      ? "border-fuel-orange bg-fuel-orange text-white"
                      : "border-hairline bg-surface-2 text-ink hover:border-hairline-strong"
                  }`}
                >
                  ₹{amt.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            {/* Touch Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2">
              {KEYPAD_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeyPress(key)}
                  className="h-12 rounded-xl border border-hairline bg-surface-2/80 text-base font-bold text-ink hover:bg-surface-3 active:scale-[0.98] transition flex items-center justify-center cursor-pointer"
                >
                  {key === "BACK" ? <Delete size={18} /> : key}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Mode & Vehicle/Customer */}
          <div className="bento-card p-4 space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_TILES.map((pm) => {
                const Icon = pm.icon;
                const active = paymentMode === pm.value;
                return (
                  <button
                    key={pm.value}
                    type="button"
                    onClick={() => setPaymentMode(pm.value)}
                    className={`rounded-xl border-2 py-3 px-2 flex flex-col items-center gap-1 text-xs font-bold transition cursor-pointer ${
                      active
                        ? "border-fuel-orange bg-fuel-orange/15 text-fuel-orange"
                        : "border-hairline bg-surface-2/60 text-ink-muted hover:text-ink"
                    }`}
                  >
                    <Icon size={18} />
                    {pm.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(formatVehiclePlate(e.target.value))}
                  placeholder="Vehicle Plate (e.g. MH12AB1234)"
                  className="h-11 font-mono uppercase"
                />
              </div>
              <div>
                <CustomerAutocomplete
                  value={customerName}
                  customerUuid={customerUuid}
                  onChange={(name, uuid) => {
                    setCustomerName(name);
                    setCustomerUuid(uuid);
                  }}
                  label=""
                />
              </div>
            </div>

            {paymentMode === "UPI" && (
              <UpiAccountSelect
                value={upiAccountUuid}
                onChange={(upiUuid, linkedBank) => {
                  setUpiAccountUuid(upiUuid);
                  setUpiLinkedBankUuid(linkedBank);
                }}
              />
            )}
          </div>
        </div>

        {/* Right: Live Thermal Slip Preview & Recent Slips (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bento-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-dashed border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-fuel-amber" />
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Live Fuel Slip Preview
                </span>
              </div>
              {lastIssuedId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">
                  <CheckCircle2 size={12} /> {lastIssuedId}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-2/50 p-4 font-mono text-xs space-y-2.5">
              <div className="text-center border-b border-dashed border-hairline pb-2">
                <p className="font-bold text-sm text-ink">PUMPLEDGER FUEL STATION</p>
                <p className="text-[11px] text-ink-muted">{today} · POS Kiosk</p>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Grade</span>
                <span className="font-bold text-ink">{fuelType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Rate</span>
                <span className="text-ink">₹{activeRate.toFixed(2)} / L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Quantity</span>
                <span className="font-bold text-ink">{calculatedLiters.toFixed(2)} L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Mode</span>
                <span className="font-bold text-ink">{paymentMode}</span>
              </div>
              {vehicleNumber && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Vehicle</span>
                  <span className="font-bold text-ink">{vehicleNumber}</span>
                </div>
              )}
              {customerName && (
                <div className="flex justify-between">
                  <span className="text-ink-muted">Customer</span>
                  <span className="font-bold text-ink truncate max-w-[160px]">{customerName}</span>
                </div>
              )}
              <div className="border-t border-dashed border-hairline pt-2 flex justify-between text-base font-black text-ink">
                <span>TOTAL</span>
                <span>{formatCurrency(numericAmount)}</span>
              </div>
              <p className="text-[10px] text-ink-subtle text-center">
                {numberToIndianWords(Math.round(numericAmount))}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() => window.print()}
              >
                <Printer size={16} className="mr-1.5" />
                Print
              </Button>
              <Button
                type="button"
                className="col-span-2 h-12 bg-fuel-orange hover:bg-primary-hover text-white font-bold text-sm"
                disabled={issueSlipMutation.isPending || numericAmount <= 0}
                onClick={() => issueSlipMutation.mutate()}
              >
                <Sparkles size={16} className="mr-1.5" />
                {issueSlipMutation.isPending ? "Issuing..." : "Issue Fuel Slip"}
              </Button>
            </div>
          </div>

          {/* Today's Last 5 Slips */}
          <div className="bento-card p-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
              Recent Slips Today
            </p>
            <div className="space-y-1.5">
              {(recentData?.items ?? []).length === 0 ? (
                <p className="text-xs text-ink-muted">No slips issued today yet.</p>
              ) : (
                (recentData?.items ?? []).map((v) => (
                  <div
                    key={v.uuid}
                    className="flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-ink truncate">
                        {v.invoice_number} · {v.fuel_type}
                      </p>
                      <p className="text-[11px] text-ink-muted truncate">
                        {v.payment_mode} {v.vehicle_number ? `· ${v.vehicle_number}` : ""}
                      </p>
                    </div>
                    <span className="font-bold text-ink tabular-nums">
                      {formatCurrency(v.total_amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
