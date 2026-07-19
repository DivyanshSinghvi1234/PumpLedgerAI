import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { HelpCircle, Save, Trash2, ArrowLeft, Edit3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "../services/inventoryService";
import type { FuelType } from "../types";

// Standard fuel items
const FUEL_ITEMS: FuelType[] = ["PETROL", "SPEED", "DIESEL", "LUBRICANT"];

const FUEL_LABELS: Record<FuelType, string> = {
  PETROL: "PETROL",
  SPEED: "POWER_PETROL", // Matches the style in the screenshot
  DIESEL: "DIESEL",
  LUBRICANT: "LUBRICANT",
};

export default function PriceSchedulesTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().split("T")[0];
  const [searchDate, setSearchDate] = useState(todayStr);
  const [activeDate, setActiveDate] = useState(todayStr);
  const [isEditing, setIsEditing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Editable rate states for each fuel item
  const [rates, setRates] = useState<Record<FuelType, string>>({
    PETROL: "",
    SPEED: "",
    DIESEL: "",
    LUBRICANT: "",
  });

  // Previous rates states for variation calculation
  const [prevRates, setPrevRates] = useState<Record<FuelType, number>>({
    PETROL: 0,
    SPEED: 0,
    DIESEL: 0,
    LUBRICANT: 0,
  });

  // Calculate 6:00 AM timestamp for the query of targeted active rates
  const targetTimeStr = `${activeDate}T06:00:00`;
  const prevDateStr = (() => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();
  const prevTimeStr = `${prevDateStr}T06:00:00`;

  // Fetch rates for active date (at 6:00 AM)
  const { data: currentRatesData, refetch: refetchCurrent } = useQuery({
    queryKey: ["rateMasterCurrent", activeDate],
    queryFn: async () => {
      const results: Record<FuelType, number> = { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };
      await Promise.all(
        FUEL_ITEMS.map(async (ft) => {
          try {
            const res = await inventoryService.getActiveRate(ft, new Date(targetTimeStr).toISOString());
            results[ft] = Number(res.rate);
          } catch {
            results[ft] = 0;
          }
        })
      );
      return results;
    },
  });

  // Fetch previous day's rates (at 6:00 AM) to calculate Rate Variation
  const { data: prevRatesData, refetch: refetchPrev } = useQuery({
    queryKey: ["rateMasterPrev", activeDate],
    queryFn: async () => {
      const results: Record<FuelType, number> = { PETROL: 0, SPEED: 0, DIESEL: 0, LUBRICANT: 0 };
      await Promise.all(
        FUEL_ITEMS.map(async (ft) => {
          try {
            const res = await inventoryService.getActiveRate(ft, new Date(prevTimeStr).toISOString());
            results[ft] = Number(res.rate);
          } catch {
            results[ft] = 0;
          }
        })
      );
      return results;
    },
  });

  // Update form inputs when data loads
  useEffect(() => {
    if (currentRatesData) {
      setRates({
        PETROL: currentRatesData.PETROL ? String(currentRatesData.PETROL) : "",
        SPEED: currentRatesData.SPEED ? String(currentRatesData.SPEED) : "",
        DIESEL: currentRatesData.DIESEL ? String(currentRatesData.DIESEL) : "",
        LUBRICANT: currentRatesData.LUBRICANT ? String(currentRatesData.LUBRICANT) : "",
      });
    }
    if (prevRatesData) {
      setPrevRates(prevRatesData);
    }
  }, [currentRatesData, prevRatesData]);

  // Mutations
  const createPriceMutation = useMutation({
    mutationFn: (data: { fuel_type: FuelType; rate: number; effective_from: string }) =>
      inventoryService.createPriceSchedule(data),
    onError: (err) => {
      toast.error("Failed to update rate.");
      console.error(err);
    },
  });

  const { data: priceSchedules } = useQuery({
    queryKey: ["priceSchedulesHistory"],
    queryFn: () => inventoryService.getPriceSchedules(),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (uuid: string) => inventoryService.deletePriceSchedule(uuid),
    onSuccess: () => {
      toast.success("Schedule deleted successfully!");
      refetchCurrent();
      refetchPrev();
      queryClient.invalidateQueries({ queryKey: ["priceSchedulesHistory"] });
    },
  });

  const handleSave = async () => {
    if (!isAdminOrManager) {
      toast.error("Price changes are restricted to administrators and managers.");
      return;
    }

    try {
      // Rates are effective at 6:00 AM on the selected date
      const local6Am = new Date(`${activeDate}T06:00:00`);
      const isoEffectiveFrom = local6Am.toISOString();

      const promises = FUEL_ITEMS.map(async (ft) => {
        const val = parseFloat(rates[ft]);
        if (isNaN(val) || val <= 0) return;

        // Only save if the rate has changed
        if (val !== currentRatesData?.[ft]) {
          await createPriceMutation.mutateAsync({
            fuel_type: ft,
            rate: val,
            effective_from: isoEffectiveFrom,
          });
        }
      });

      await Promise.all(promises);
      toast.success(`Rates updated successfully for ${activeDate} starting at 6:00 AM!`);
      setIsEditing(false);
      refetchCurrent();
      refetchPrev();
      queryClient.invalidateQueries({ queryKey: ["priceSchedulesHistory"] });
    } catch (err) {
      toast.error("Failed to save some rates.");
      console.error(err);
    }
  };

  const handleDeleteSchedulesForDate = () => {
    if (!priceSchedules) return;

    // Find and delete price schedules that match the activeDate
    const targetDateStr = new Date(`${activeDate}T06:00:00`).toDateString();
    const matches = priceSchedules.filter(
      (s) => new Date(s.effective_from).toDateString() === targetDateStr
    );

    if (matches.length === 0) {
      toast.info("No custom schedules found for this date to delete.");
      return;
    }

    Promise.all(matches.map((m) => deleteScheduleMutation.mutateAsync(m.uuid)))
      .then(() => {
        toast.success(`Deleted schedules for ${activeDate}`);
      })
      .catch((err) => {
        toast.error("Failed to delete schedules.");
        console.error(err);
      });
  };

  const handleBack = () => {
    setSearchDate(todayStr);
    setActiveDate(todayStr);
    setIsEditing(false);
  };

  const handleRateChange = (ft: FuelType, val: string) => {
    setRates((prev) => ({ ...prev, [ft]: val }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in print:p-0">
      
      {/* ── Title Master ── */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold tracking-wider text-ink font-serif uppercase" style={{ color: "var(--color-primary-focus, #ea580c)" }}>
          Rate Master
        </h2>
        <p className="text-xs text-ink-subtle italic">
          Fuel Price Mapping & Variation Console
        </p>
      </div>

      <Card className="glass border-hairline overflow-hidden shadow-xl" style={{ fontFamily: "Courier New, monospace" }}>
        <CardContent className="p-6 space-y-6">
          
          {/* ── Search bar (Date Input) ── */}
          <div className="flex items-center justify-center gap-4 flex-wrap pb-4 border-b border-hairline/60 no-print">
            <div className="flex items-center gap-2">
              <Label htmlFor="searchDate" className="text-xs font-bold text-ink-muted uppercase">
                Date :
              </Label>
              <Input
                id="searchDate"
                type="date"
                value={searchDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setSearchDate(newDate);
                  setActiveDate(newDate);
                  setIsEditing(false);
                }}
                className="bg-surface-2 border-hairline text-sm text-ink h-8 px-3 rounded w-44 font-mono focus:border-fuel-amber"
              />
            </div>
          </div>

          {/* ── Rates Table ── */}
          <div className="overflow-x-auto">
            <Table className="min-w-full text-xs border border-hairline">
              <TableHeader className="bg-surface-2 border-b border-hairline">
                <TableRow>
                  <TableHead className="px-4 py-2 font-bold text-ink uppercase tracking-wider text-left">
                    Date
                  </TableHead>
                  <TableHead className="px-4 py-2 font-bold text-ink uppercase tracking-wider text-left">
                    Item Name
                  </TableHead>
                  <TableHead className="px-4 py-2 font-bold text-ink uppercase tracking-wider text-right w-[30%]">
                    Sale Rate (₹)
                  </TableHead>
                  <TableHead className="px-4 py-2 font-bold text-ink uppercase tracking-wider text-right">
                    Rate Variation
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FUEL_ITEMS.map((ft) => {
                  const currentVal = rates[ft] !== "" ? parseFloat(rates[ft]) : 0;
                  const prevVal = prevRates[ft] || 0;
                  const variation = prevVal > 0 && currentVal > 0 ? currentVal - prevVal : 0;

                  return (
                    <TableRow key={ft} className="border-b border-hairline hover:bg-surface-2/40">
                      <td className="px-4 py-3 font-semibold text-ink-muted">
                        {new Date(activeDate).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 font-bold text-ink">
                        {FUEL_LABELS[ft]}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={rates[ft]}
                            onChange={(e) => handleRateChange(ft, e.target.value)}
                            className="bg-surface-1 border-hairline text-right font-bold text-xs h-7 px-2 font-mono text-ink rounded w-full ml-auto"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-bold text-sm text-ink font-mono">
                            {rates[ft] !== "" ? Number(rates[ft]).toFixed(2) : "0.00"}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold ${
                        variation > 0 ? "text-emerald-600" : variation < 0 ? "text-red-500" : "text-ink-subtle"
                      }`}>
                        {variation > 0 ? "+" : ""}{variation !== 0 ? variation.toFixed(2) : "0.00"}
                      </td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── Help / Notice Section ── */}
          {showHelp && (
            <div className="bg-surface-2 border border-hairline p-3 rounded text-[11px] text-ink-muted space-y-1.5 animate-fade-in no-print">
              <p className="font-bold text-fuel-amber uppercase tracking-wider flex items-center gap-1">
                <HelpCircle size={13} /> Fuel Rate Timing & Schedules Info
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Rate master coordinates changes that typically occur at **6:00 AM** daily.</li>
                <li>When saving rates, the system automatically schedules them starting at **6:00 AM** on the chosen date.</li>
                <li>Voucher calculations (Fuel Sales, Invoices) use the active rate effective at the time of the transaction.</li>
                <li>Rate Variation shows price differences compared to the previous day's rate.</li>
              </ul>
            </div>
          )}

          {/* ── Controls Row (Retro Styling Buttons) ── */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-hairline/60 no-print">
            <Button
              onClick={handleSave}
              disabled={!isEditing}
              className="bg-teal-500/20 text-teal-600 hover:bg-teal-500/30 border border-teal-500/30 font-bold text-xs h-9 px-6 rounded cursor-pointer uppercase shadow-sm disabled:opacity-50"
            >
              <Save size={13} className="mr-1.5" /> Save
            </Button>

            <Button
              onClick={handleDeleteSchedulesForDate}
              variant="ghost"
              className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 font-bold text-xs h-9 px-6 rounded cursor-pointer uppercase shadow-sm"
            >
              <Trash2 size={13} className="mr-1.5" /> Delete
            </Button>

            <Button
              onClick={handleBack}
              className="bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 border border-stone-500/20 font-bold text-xs h-9 px-6 rounded cursor-pointer uppercase shadow-sm"
            >
              <ArrowLeft size={13} className="mr-1.5" /> Back
            </Button>

            <Button
              onClick={() => setShowHelp((h) => !h)}
              className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 border border-sky-500/20 font-bold text-xs h-9 px-6 rounded cursor-pointer uppercase shadow-sm"
            >
              <HelpCircle size={13} className="mr-1.5" /> Help
            </Button>

            <Button
              onClick={() => setIsEditing((e) => !e)}
              className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 font-bold text-xs h-9 px-6 rounded cursor-pointer uppercase shadow-sm"
            >
              <Edit3 size={13} className="mr-1.5" /> Edit
            </Button>
          </div>

        </CardContent>
      </Card>
      
      {/* ── Active History / Scheduled changes overview ── */}
      {priceSchedules && priceSchedules.length > 0 && (
        <Card className="glass border-hairline/60 no-print" style={{ fontFamily: "Courier New, monospace" }}>
          <CardContent className="p-4 space-y-3">
            <h4 className="text-[10px] font-black uppercase text-ink-subtle tracking-wider">
              Upcoming scheduled rate shifts
            </h4>
            <div className="space-y-2">
              {priceSchedules.slice(0, 5).map((sched) => {
                const isFuture = new Date(sched.effective_from).getTime() > Date.now();
                return (
                  <div key={sched.uuid} className="flex justify-between items-center text-xs p-2 rounded bg-surface-2 border border-hairline/40">
                    <div className="flex items-center gap-2">
                      <Badge className="text-[8px] bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent font-bold">
                        {FUEL_LABELS[sched.fuel_type as FuelType]}
                      </Badge>
                      <span className="font-bold text-ink">₹{Number(sched.rate).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-ink-subtle">
                        Effective: {new Date(sched.effective_from).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isFuture && (
                        <Badge className="text-[8px] bg-sky-500/10 text-sky-500 border-transparent">
                          Scheduled
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
