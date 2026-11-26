import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Fuel, Sparkles, TrendingUp, Upload } from "lucide-react";
import { toast } from "sonner";
import api from "@/api/client";
import BankAccountSelect from "@/components/common/BankAccountSelect";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function TankMarginAnalyticsCard() {
  const queryClient = useQueryClient();
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const [tankUuid, setTankUuid] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getTodayDateString());
  const [quantityLiters, setQuantityLiters] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [density, setDensity] = useState("");
  const [supplierName, setSupplierName] = useState("IOCL");
  const [bankUuid, setBankUuid] = useState("");
  const [dipBefore, setDipBefore] = useState("");
  const [dipAfter, setDipAfter] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const { data } = useQuery({
    queryKey: ["tank-margin-analytics"],
    queryFn: async () => {
      const res = await api.get("/fuel-tanks/margin-analytics");
      return res.data as {
        tanks: Array<{
          tank_uuid: string;
          tank_name: string;
          fuel_type: string;
          current_stock_liters: number;
          capacity_liters: number;
          fill_percent: number;
          avg_cost_per_liter: number;
          selling_rate: number;
          margin_per_liter: number;
          today_net_sales_liters: number;
          today_dip_variance_liters: number;
          today_gross_profit: number;
        }>;
        procurement_trend: Array<{
          date: string;
          fuel_type: string;
          procurement_rate: number;
          selling_rate: number;
          quantity_liters: number;
        }>;
        indent_bank_alert: {
          pending_indent_count: number;
          pending_indent_cost: number;
          total_bank_balance: number;
          is_short: boolean;
          shortfall: number;
        };
      };
    },
  });

  const autopilotMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/fuel-tanks/omc-ocr-autopilot", {
        tank_uuid: tankUuid,
        invoice_number: invoiceNumber,
        delivery_date: deliveryDate,
        quantity_liters: Number(quantityLiters),
        total_amount: Number(totalAmount),
        density: density ? Number(density) : null,
        supplier_name: supplierName,
        bank_account_uuid: bankUuid || null,
        payment_mode: bankUuid ? "BANK" : "CREDIT",
        dip_before_liters: dipBefore ? Number(dipBefore) : null,
        dip_after_liters: dipAfter ? Number(dipAfter) : null,
      });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(
        `Tanker Auto-Pilot complete! Stock: ${res.new_tank_stock}L, Avg Cost: ₹${res.new_avg_cost_per_liter}/L${
          res.matched_indent_number ? ` (Matched ${res.matched_indent_number})` : ""
        }`
      );
      setAutopilotOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tank-margin-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-indents"] });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts-summary"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "OMC Auto-Pilot failed.");
    },
  });

  const handleOcrFile = async (file: File) => {
    setIsScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imagePath = up.data?.file_path || up.data?.image_path;
      if (imagePath) {
        const ocr = await api.post("/vision/ocr", null, { params: { image_path: imagePath } });
        const d = ocr.data || {};
        if (d.invoice_number) setInvoiceNumber(String(d.invoice_number));
        if (d.quantity_liters) setQuantityLiters(String(d.quantity_liters));
        if (d.total_amount) setTotalAmount(String(d.total_amount));
        if (d.invoice_date) setDeliveryDate(String(d.invoice_date));
        toast.success("OMC Invoice scanned — verify fields and run Auto-Pilot.");
      }
    } catch {
      toast.info("Could not auto-extract all fields — please fill manually.");
    } finally {
      setIsScanning(false);
    }
  };

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Low Bank Balance Alert for Upcoming OMC Indents */}
      {data.indent_bank_alert.is_short && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Low Bank Balance for OMC Indents: {data.indent_bank_alert.pending_indent_count} pending indent(s) require{" "}
              <strong>{formatCurrency(data.indent_bank_alert.pending_indent_cost)}</strong>, but total bank balance is{" "}
              <strong>{formatCurrency(data.indent_bank_alert.total_bank_balance)}</strong> (Short by{" "}
              <strong>{formatCurrency(data.indent_bank_alert.shortfall)}</strong>).
            </span>
          </div>
        </div>
      )}

      {/* Tank-Wise Profit & Variance Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Fuel className="h-4 w-4 text-fuel-amber" />
            Tank-Wise Margin, Profit & Dip Variance
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs cursor-pointer"
            onClick={() => {
              if (!tankUuid && data.tanks[0]) setTankUuid(data.tanks[0].tank_uuid);
              setAutopilotOpen((v) => !v);
            }}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-fuel-amber" />
            OMC Invoice OCR Auto-Pilot
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {autopilotOpen && (
            <div className="rounded-xl border border-fuel-amber/30 bg-surface-2 p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">OMC Invoice OCR → Tanker Auto-Pilot</span>
                <label className="inline-flex items-center gap-1.5 rounded border border-hairline bg-surface-1 px-2.5 py-1 cursor-pointer hover:bg-surface-3">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isScanning ? "Scanning..." : "Scan IOCL/BPCL/HPCL Invoice"}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleOcrFile(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Target Tank</label>
                  <select
                    value={tankUuid}
                    onChange={(e) => setTankUuid(e.target.value)}
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink"
                  >
                    {data.tanks.map((t) => (
                      <option key={t.tank_uuid} value={t.tank_uuid}>
                        {t.tank_name} ({t.fuel_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">OMC / Supplier</label>
                  <input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Invoice #</label>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-..."
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Liters</label>
                  <input
                    type="number"
                    value={quantityLiters}
                    onChange={(e) => setQuantityLiters(e.target.value)}
                    placeholder="12000"
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Total Amount (₹)</label>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="1050000"
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">15°C Density</label>
                  <input
                    type="number"
                    step="0.1"
                    value={density}
                    onChange={(e) => setDensity(e.target.value)}
                    placeholder="832.4"
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink font-mono"
                  />
                </div>
                <BankAccountSelect
                  value={bankUuid}
                  onChange={setBankUuid}
                  label="Debit Bank (RTGS)"
                />
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Dip Before (L)</label>
                  <input
                    type="number"
                    value={dipBefore}
                    onChange={(e) => setDipBefore(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-ink-muted mb-1">Dip After (L)</label>
                  <input
                    type="number"
                    value={dipAfter}
                    onChange={(e) => setDipAfter(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded border border-hairline bg-surface-1 px-2 py-1.5 text-ink font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setAutopilotOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-fuel-amber text-canvas"
                  disabled={autopilotMutation.isPending || !tankUuid || !quantityLiters || !totalAmount}
                  onClick={() => autopilotMutation.mutate()}
                >
                  {autopilotMutation.isPending ? "Running..." : "Match Indent & Post Delivery"}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.tanks.map((t) => (
              <div
                key={t.tank_uuid}
                className="rounded-xl border border-hairline bg-surface-2 p-3.5 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{t.tank_name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-3 font-mono text-[10px]">
                    {t.fuel_type} · {t.fill_percent}%
                  </span>
                </div>
                {/* Animated Liquid Tank Level Bar */}
                <div className="h-2.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      t.fill_percent < 20 || t.fill_percent > 95
                        ? "bg-rose-500"
                        : t.fill_percent < 35
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, t.fill_percent))}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
                  <span className="text-ink-muted">Avg Cost/L:</span>
                  <span className="text-right">₹{Number(t.avg_cost_per_liter ?? 0).toFixed(2)}</span>
                  <span className="text-ink-muted">Selling Rate:</span>
                  <span className="text-right">₹{Number(t.selling_rate ?? 0).toFixed(2)}</span>
                  <span className="text-ink-muted">Margin/L:</span>
                  <span className="text-right text-emerald-500 font-semibold">
                    ₹{Number(t.margin_per_liter ?? 0).toFixed(2)}
                  </span>
                  <span className="text-ink-muted">Today Net Sales:</span>
                  <span className="text-right">{Number(t.today_net_sales_liters ?? 0).toFixed(1)} L</span>
                  <span className="text-ink-muted">Dip Variance:</span>
                  <span
                    className={`text-right ${
                      Number(t.today_dip_variance_liters ?? 0) < 0 ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {Number(t.today_dip_variance_liters ?? 0) >= 0 ? "+" : ""}
                    {Number(t.today_dip_variance_liters ?? 0).toFixed(1)} L
                  </span>
                </div>
                <div className="border-t border-hairline pt-1.5 flex justify-between font-bold">
                  <span>Today Gross Profit</span>
                  <span className={t.today_gross_profit >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {formatCurrency(t.today_gross_profit)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Procurement Cost-Per-Liter Trend */}
          {data.procurement_trend.length > 0 && (
            <div className="pt-2 border-t border-hairline">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                Tanker Procurement Cost/L vs. Selling Price Trend
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] font-mono">
                {data.procurement_trend.slice(-6).map((pt, idx) => {
                  const buy = Number(pt.procurement_rate ?? 0);
                  const sell = Number(pt.selling_rate ?? 0);
                  const spread = sell - buy;
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-hairline bg-surface-2 px-2.5 py-1.5"
                    >
                      <div className="text-ink-muted">{pt.date} · {pt.fuel_type}</div>
                      <div className="font-semibold text-ink">
                        Buy ₹{buy.toFixed(2)}
                      </div>
                      <div className={spread >= 0 ? "text-emerald-500" : "text-rose-500"}>
                        Margin ₹{spread.toFixed(2)}/L
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
