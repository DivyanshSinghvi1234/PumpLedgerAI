import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, CheckCircle2, Landmark, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import api from "@/api/client";
import PageHeader from "@/components/common/PageHeader";
import UpiCollectionBreakdown from "@/components/common/UpiCollectionBreakdown";
import { formatCurrency, getTodayDateString } from "@/lib/utils";
import ShiftHandoverPanel from "./components/ShiftHandoverPanel";
import staffService from "@/features/staff/services/staffService";

interface NozzleLineState {
  nozzle_uuid?: string;
  nozzle_name: string;
  fuel_type: string;
  opening_reading: number;
  interim_6am_reading: string;
  closing_reading: string;
  testing_liters: string;
  old_rate: number;
  new_rate: string;
}

interface SettlementDefaults {
  settlement_date: string;
  previous_handover_float: number;
  credit_vouchers_total: number;
  cash_expenses_total: number;
  nozzles: {
    nozzle_uuid: string;
    nozzle_name: string;
    fuel_type: string;
    opening_reading: number;
    active_rate: number;
  }[];
}

interface ShiftSettlementRecord {
  uuid: string;
  settlement_date: string;
  shift_label: string;
  attendant_names: string | null;
  opening_float: number;
  gross_meter_sales: number;
  credit_sales_total: number;
  upi_total: number;
  card_edc_total: number;
  omc_fleet_card_total: number;
  mdr_fee_percent: number;
  digital_settlement_status: string;
  expenses_cash_total: number;
  cash_handed_to_next_shift: number;
  expected_cash_in_hand: number;
  actual_cash_counted: number;
  variance: number;
}

interface BankAccountItem {
  uuid: string;
  account_name: string;
  bank_name: string;
}

export default function ShiftSettlementPage() {
  const queryClient = useQueryClient();
  const [settlementDate, setSettlementDate] = useState(getTodayDateString());
  const [shiftLabel, setShiftLabel] = useState<"DAY_SHIFT" | "NIGHT_SHIFT">("DAY_SHIFT");
  const [attendantNames, setAttendantNames] = useState("");
  const [responsibleEmpUuid, setResponsibleEmpUuid] = useState("");
  const [chargeShortage, setChargeShortage] = useState(true);

  const [openingFloatInput, setOpeningFloatInput] = useState<string | null>(null);
  const [nozzleLinesInput, setNozzleLinesInput] = useState<NozzleLineState[] | null>(null);
  const [manualGrossSales, setManualGrossSales] = useState("0");

  const [creditTotalInput, setCreditTotalInput] = useState<string | null>(null);
  const [upiTotal, setUpiTotal] = useState("0");
  const [cardEdcTotal, setCardEdcTotal] = useState("0");
  const [omcFleetTotal, setOmcFleetTotal] = useState("0");
  const [mdrPercent, setMdrPercent] = useState("0");
  const [expensesCashInput, setExpensesCashInput] = useState<string | null>(null);
  const [cashNextShift, setCashNextShift] = useState("0");

  const [notes500, setNotes500] = useState("0");
  const [notes200, setNotes200] = useState("0");
  const [notes100, setNotes100] = useState("0");
  const [notes50, setNotes50] = useState("0");
  const [notes20, setNotes20] = useState("0");
  const [notes10, setNotes10] = useState("0");
  const [coinsAmount, setCoinsAmount] = useState("0");
  const [selectedBankUuid, setSelectedBankUuid] = useState("");

  const { data: defaults } = useQuery({
    queryKey: ["shift-settlement-defaults", settlementDate],
    queryFn: async () => {
      const res = await api.get<SettlementDefaults>("/v1/shifts/settlements/defaults", {
        params: { settlement_date: settlementDate },
      });
      return res.data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: () => staffService.listEmployees(),
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-list"],
    queryFn: async () => {
      const res = await api.get<BankAccountItem[]>("/v1/bank-accounts");
      return res.data;
    },
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ["shift-settlements"],
    queryFn: async () => {
      const res = await api.get<ShiftSettlementRecord[]>("/v1/shifts/settlements");
      return res.data;
    },
  });

  const openingFloat = openingFloatInput ?? String(defaults?.previous_handover_float ?? 0);
  const creditTotal = creditTotalInput ?? String(defaults?.credit_vouchers_total ?? 0);
  const expensesCash = expensesCashInput ?? String(defaults?.cash_expenses_total ?? 0);
  const nozzleLines = useMemo<NozzleLineState[]>(() => {
    if (nozzleLinesInput !== null) return nozzleLinesInput;
    return (defaults?.nozzles ?? []).map((n) => ({
      nozzle_uuid: n.nozzle_uuid,
      nozzle_name: n.nozzle_name,
      fuel_type: n.fuel_type,
      opening_reading: n.opening_reading,
      interim_6am_reading: "",
      closing_reading: String(n.opening_reading),
      testing_liters: "0",
      old_rate: Number(n.active_rate) || 0,
      new_rate: "",
    }));
  }, [nozzleLinesInput, defaults]);

  const grossMeterSales = useMemo(() => {
    if (nozzleLines.length === 0) return Number(manualGrossSales) || 0;
    return nozzleLines.reduce((sum, l) => {
      const open = Number(l.opening_reading) || 0;
      const close = Number(l.closing_reading) || 0;
      const testL = Number(l.testing_liters) || 0;
      const oldRate = Number(l.old_rate) || 0;
      if (l.interim_6am_reading.trim() !== "") {
        const interim = Number(l.interim_6am_reading) || 0;
        const newRate = l.new_rate.trim() !== "" ? Number(l.new_rate) : oldRate;
        const v1 = Math.max(0, interim - open);
        const v2 = Math.max(0, close - interim - testL);
        return sum + v1 * oldRate + v2 * newRate;
      }
      const vol = Math.max(0, close - open - testL);
      return sum + vol * oldRate;
    }, 0);
  }, [nozzleLines, manualGrossSales]);

  const expectedCash = useMemo(() => {
    return (
      (Number(openingFloat) || 0) +
      grossMeterSales -
      (Number(creditTotal) || 0) -
      (Number(upiTotal) || 0) -
      (Number(cardEdcTotal) || 0) -
      (Number(omcFleetTotal) || 0) -
      (Number(expensesCash) || 0) -
      (Number(cashNextShift) || 0)
    );
  }, [
    openingFloat,
    grossMeterSales,
    creditTotal,
    upiTotal,
    cardEdcTotal,
    omcFleetTotal,
    expensesCash,
    cashNextShift,
  ]);

  const actualCounted = useMemo(() => {
    return (
      (Number(notes500) || 0) * 500 +
      (Number(notes200) || 0) * 200 +
      (Number(notes100) || 0) * 100 +
      (Number(notes50) || 0) * 50 +
      (Number(notes20) || 0) * 20 +
      (Number(notes10) || 0) * 10 +
      (Number(coinsAmount) || 0)
    );
  }, [notes500, notes200, notes100, notes50, notes20, notes10, coinsAmount]);

  const variance = actualCounted - expectedCash;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        settlement_date: settlementDate,
        shift_label: shiftLabel,
        attendant_names: attendantNames.trim() || null,
        responsible_employee_uuid: responsibleEmpUuid || null,
        opening_float: Number(openingFloat) || 0,
        nozzle_lines: nozzleLines.map((l) => ({
          nozzle_uuid: l.nozzle_uuid,
          nozzle_name: l.nozzle_name,
          fuel_type: l.fuel_type,
          opening_reading: l.opening_reading,
          interim_6am_reading: l.interim_6am_reading.trim() !== "" ? Number(l.interim_6am_reading) : null,
          closing_reading: Number(l.closing_reading) || 0,
          testing_liters: Number(l.testing_liters) || 0,
          old_rate: l.old_rate,
          new_rate: l.new_rate.trim() !== "" ? Number(l.new_rate) : null,
        })),
        manual_gross_sales: nozzleLines.length === 0 ? Number(manualGrossSales) || 0 : null,
        credit_sales_total: Number(creditTotal) || 0,
        upi_total: Number(upiTotal) || 0,
        card_edc_total: Number(cardEdcTotal) || 0,
        omc_fleet_card_total: Number(omcFleetTotal) || 0,
        mdr_fee_percent: Number(mdrPercent) || 0,
        expenses_cash_total: Number(expensesCash) || 0,
        cash_handed_to_next_shift: Number(cashNextShift) || 0,
        notes_500: Number(notes500) || 0,
        notes_200: Number(notes200) || 0,
        notes_100: Number(notes100) || 0,
        notes_50: Number(notes50) || 0,
        notes_20: Number(notes20) || 0,
        notes_10: Number(notes10) || 0,
        coins_amount: Number(coinsAmount) || 0,
        charge_shortage_to_staff: chargeShortage,
      };
      const res = await api.post("/v1/shifts/settlements", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("8:00 PM shift settlement recorded");
      queryClient.invalidateQueries({ queryKey: ["shift-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["shift-settlement-defaults"] });
    },
    onError: () => toast.error("Failed to save shift settlement"),
  });

  const settleDigitalMutation = useMutation({
    mutationFn: async (uuid: string) => {
      const bankUuid = selectedBankUuid || bankAccounts[0]?.uuid;
      if (!bankUuid) throw new Error("Add a bank account first");
      const res = await api.post(`/v1/shifts/settlements/${uuid}/settle-digital`, {
        bank_account_uuid: bankUuid,
        settled_date: getTodayDateString(),
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("UPI + Card batch credited to bank");
      queryClient.invalidateQueries({ queryKey: ["shift-settlements"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to settle digital batch"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="8:00 PM Shift Settlement"
        description="Pool floating staff collections, 6 AM price-change splits, handover float, and cash denomination variance."
      />

      {/* Shift Metadata */}
      <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            value={settlementDate}
            onChange={(e) => setSettlementDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Shift</label>
          <select
            value={shiftLabel}
            onChange={(e) => setShiftLabel(e.target.value as "DAY_SHIFT" | "NIGHT_SHIFT")}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="DAY_SHIFT">Day Shift (8 AM – 8 PM)</option>
            <option value="NIGHT_SHIFT">Night Shift (8 PM – 8 AM)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Floating Staff Names</label>
          <input
            placeholder="e.g. Ramesh, Suresh"
            value={attendantNames}
            onChange={(e) => setAttendantNames(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Opening Float (Auto)</label>
          <input
            type="number"
            value={openingFloat}
            onChange={(e) => setOpeningFloatInput(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Shortage Accountable Staff</label>
          <select
            value={responsibleEmpUuid}
            onChange={(e) => setResponsibleEmpUuid(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">None (Pump absorbed)</option>
            {employees.map((e) => (
              <option key={e.uuid} value={e.uuid}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Nozzle Meter Readings (with 6 AM price split) */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Nozzle Readings &amp; 6:00 AM Price Split</h3>
          <span className="text-sm font-bold font-mono">
            Gross Meter Sales: {formatCurrency(grossMeterSales)}
          </span>
        </div>

        {nozzleLines.length === 0 ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">No active nozzles configured — enter gross meter sales directly:</span>
            <input
              type="number"
              value={manualGrossSales}
              onChange={(e) => setManualGrossSales(e.target.value)}
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/50 uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Nozzle</th>
                  <th className="px-2 py-2 text-right">Opening</th>
                  <th className="px-2 py-2 text-right">6 AM Reading</th>
                  <th className="px-2 py-2 text-right">Closing</th>
                  <th className="px-2 py-2 text-right">Testing (L)</th>
                  <th className="px-2 py-2 text-right">Old Rate</th>
                  <th className="px-2 py-2 text-right">New Rate</th>
                </tr>
              </thead>
              <tbody>
                {nozzleLines.map((line, idx) => (
                  <tr key={line.nozzle_uuid || idx} className="border-t border-border">
                    <td className="px-2 py-2 font-medium">{line.nozzle_name} ({line.fuel_type})</td>
                    <td className="px-2 py-2 text-right font-mono">{line.opening_reading}</td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        placeholder="Optional"
                        value={line.interim_6am_reading}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNozzleLinesInput(nozzleLines.map((r, i) => (i === idx ? { ...r, interim_6am_reading: val } : r)));
                        }}
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        value={line.closing_reading}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNozzleLinesInput(nozzleLines.map((r, i) => (i === idx ? { ...r, closing_reading: val } : r)));
                        }}
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        value={line.testing_liters}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNozzleLinesInput(nozzleLines.map((r, i) => (i === idx ? { ...r, testing_liters: val } : r)));
                        }}
                        className="w-20 rounded border border-border bg-background px-2 py-1 text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{line.old_rate}</td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        placeholder="If changed"
                        value={line.new_rate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNozzleLinesInput(nozzleLines.map((r, i) => (i === idx ? { ...r, new_rate: val } : r)));
                        }}
                        className="w-24 rounded border border-border bg-background px-2 py-1 text-right font-mono"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collections Pool & Cash Denomination Counter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Pooled Collections &amp; Deductions (₹)</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="text-xs text-muted-foreground">Credit Vouchers</label>
              <input type="number" value={creditTotal} onChange={(e) => setCreditTotalInput(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">UPI / QR Total</label>
              <input type="number" value={upiTotal} onChange={(e) => setUpiTotal(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">EDC Card Swipes</label>
              <input type="number" value={cardEdcTotal} onChange={(e) => setCardEdcTotal(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Card MDR Fee %</label>
              <input type="number" step="0.1" value={mdrPercent} onChange={(e) => setMdrPercent(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">OMC Fleet Card (XTRAPOWER/etc)</label>
              <input type="number" value={omcFleetTotal} onChange={(e) => setOmcFleetTotal(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Out-of-Drawer Expenses</label>
              <input type="number" value={expensesCash} onChange={(e) => setExpensesCashInput(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Cash Handed Over to Next Shift (Float)</label>
              <input type="number" value={cashNextShift} onChange={(e) => setCashNextShift(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-1.5 font-mono" />
            </div>
          </div>
          <UpiCollectionBreakdown date={settlementDate} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Physical Cash Denomination Count</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-sm">
            {[
              { label: "₹500", val: notes500, set: setNotes500 },
              { label: "₹200", val: notes200, set: setNotes200 },
              { label: "₹100", val: notes100, set: setNotes100 },
              { label: "₹50", val: notes50, set: setNotes50 },
              { label: "₹20", val: notes20, set: setNotes20 },
              { label: "₹10", val: notes10, set: setNotes10 },
              { label: "Coins (₹)", val: coinsAmount, set: setCoinsAmount },
            ].map((d) => (
              <div key={d.label}>
                <label className="text-xs text-muted-foreground">{d.label}</label>
                <input
                  type="number"
                  value={d.val}
                  onChange={(e) => d.set(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 font-mono"
                />
              </div>
            ))}
          </div>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected Cash in Hand:</span>
              <span className="font-mono font-semibold">{formatCurrency(expectedCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Actual Cash Counted:</span>
              <span className="font-mono font-semibold">{formatCurrency(actualCounted)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-semibold">Variance (Shortage / Excess):</span>
              <span className={`font-mono font-bold inline-flex items-center gap-1 ${variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {variance < 0 && <AlertTriangle className="h-4 w-4" />}
                {variance > 0 ? "+" : ""}{formatCurrency(variance)}
              </span>
            </div>
          </div>

          {responsibleEmpUuid && variance < 0 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <input
                type="checkbox"
                checked={chargeShortage}
                onChange={(e) => setChargeShortage(e.target.checked)}
              />
              Post shortage ({formatCurrency(Math.abs(variance))}) to selected staff ledger
            </label>
          )}

          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Calculator className="h-4 w-4" />
            Save 8:00 PM Shift Settlement
          </button>
        </div>
      </div>

      {/* Recent Settlements */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Recent Shift Settlements</h3>
          {bankAccounts.length > 0 && (
            <select
              value={selectedBankUuid || bankAccounts[0].uuid}
              onChange={(e) => setSelectedBankUuid(e.target.value)}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs"
            >
              {bankAccounts.map((b) => (
                <option key={b.uuid} value={b.uuid}>
                  Settle Digital to: {b.account_name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50 uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date / Shift</th>
                <th className="px-3 py-2 text-left">Staff</th>
                <th className="px-3 py-2 text-right">Meter Sales</th>
                <th className="px-3 py-2 text-right">UPI + Card</th>
                <th className="px-3 py-2 text-right">Next Float</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-right">Digital Status</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.uuid} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{s.settlement_date} · {s.shift_label}</td>
                  <td className="px-3 py-2">{s.attendant_names || "-"}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(s.gross_meter_sales)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(Number(s.upi_total) + Number(s.card_edc_total))}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(s.cash_handed_to_next_shift)}</td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${s.variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {formatCurrency(s.variance)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {s.digital_settlement_status === "SETTLED" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => settleDigitalMutation.mutate(s.uuid)}
                        className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-white"
                      >
                        <Landmark className="h-3 w-3" /> Settle to Bank
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ShiftHandoverPanel employees={employees} />
    </div>
  );
}
