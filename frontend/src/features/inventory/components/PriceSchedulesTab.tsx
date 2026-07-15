import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "../services/inventoryService";
import type { FuelType, PriceScheduleCreate } from "../types";

export default function PriceSchedulesTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  // Dialog & Form states
  const [deletePriceScheduleDialogOpen, setDeletePriceScheduleDialogOpen] = useState(false);
  const [selectedPriceScheduleUuid, setSelectedPriceScheduleUuid] = useState("");

  const [priceFuelType, setPriceFuelType] = useState<FuelType>("PETROL");
  const [priceRate, setPriceRate] = useState("");
  // Helper to format a Date object as a local ISO string (YYYY-MM-DDTHH:mm)
  const getLocalDateTimeString = (date: Date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [priceEffectiveFrom, setPriceEffectiveFrom] = useState(
    getLocalDateTimeString(new Date(Date.now() + 60000))
  );

  // Queries
  const { data: activeRates, isLoading: activeRatesLoading } = useQuery({
    queryKey: ["activeRates"],
    queryFn: async () => {
      const fuelTypes: FuelType[] = ["PETROL", "SPEED", "DIESEL", "LUBRICANT"];
      const rates: Record<FuelType, number> = {
        PETROL: 104.20,
        SPEED: 108.50,
        DIESEL: 95.50,
        LUBRICANT: 320.00,
      };
      
      await Promise.all(
        fuelTypes.map(async (ft) => {
          try {
            const res = await inventoryService.getActiveRate(ft);
            rates[ft] = Number(res.rate);
          } catch (err) {
            console.error(`Error loading rate for ${ft}:`, err);
          }
        })
      );
      return rates;
    },
    refetchInterval: 10000,
  });

  const { data: priceSchedules, isLoading: priceSchedulesLoading } = useQuery({
    queryKey: ["priceSchedules"],
    queryFn: () => inventoryService.getPriceSchedules(),
    refetchInterval: 10000,
  });

  // Mutations
  const createPriceMutation = useMutation({
    mutationFn: (data: PriceScheduleCreate) => inventoryService.createPriceSchedule(data),
    onSuccess: () => {
      toast.success("Fuel price schedule added successfully!");
      setPriceRate("");
      queryClient.invalidateQueries({ queryKey: ["activeRates"] });
      queryClient.invalidateQueries({ queryKey: ["priceSchedules"] });
    },
    onError: (err) => {
      toast.error("Failed to create price schedule.");
      console.error(err);
    },
  });

  const syncPricesMutation = useMutation({
    mutationFn: () => inventoryService.syncLiveRates(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activeRates"] });
      queryClient.invalidateQueries({ queryKey: ["priceSchedules"] });
      if (data.live) {
        toast.success(
          `Successfully synced live rates! Petrol: ₹${data.PETROL}, Speed: ₹${data.SPEED}, Diesel: ₹${data.DIESEL}`
        );
      } else {
        toast.warning(
          `Failed to scrape live rates, fell back to default prices. Petrol: ₹${data.PETROL}, Speed: ₹${data.SPEED}, Diesel: ₹${data.DIESEL}`
        );
      }
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to sync prices.";
      toast.error(msg);
    },
  });

  const deletePriceScheduleMutation = useMutation({
    mutationFn: (uuid: string) => inventoryService.deletePriceSchedule(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeRates"] });
      queryClient.invalidateQueries({ queryKey: ["priceSchedules"] });
      setDeletePriceScheduleDialogOpen(false);
      toast.success("Price schedule deleted successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to delete price schedule.";
      toast.error(msg);
    },
  });

  // Submit Handlers
  const handleCreatePriceSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceRate || !priceEffectiveFrom) {
      toast.error("Please specify a rate and effective timestamp.");
      return;
    }
    
    // Parse the local date-time string safely in local timezone
    const [datePart, timePart] = priceEffectiveFrom.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);
    const localDate = new Date(year, month - 1, day, hour, minute);

    createPriceMutation.mutate({
      fuel_type: priceFuelType,
      rate: parseFloat(priceRate),
      effective_from: localDate.toISOString(),
    });
  };

  const handleDeletePriceSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    deletePriceScheduleMutation.mutate(selectedPriceScheduleUuid);
  };

  return (
    <div className="grid gap-8 md:grid-cols-3 animate-fade-in">
      {/* Scheduling Form */}
      {isAdminOrManager ? (
        <Card className="glass border-hairline md:col-span-1 h-fit">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-fuel-amber" />
              <CardTitle className="text-base font-bold tracking-tight text-ink">
                Schedule Price Change
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-ink-subtle">
              Create a future price adjustment that applies automatically when creating invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePriceSchedule} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="priceFuelType" className="text-xs font-semibold text-ink-muted">
                  Fuel Type
                </Label>
                <select
                  id="priceFuelType"
                  value={priceFuelType}
                  onChange={(e) => setPriceFuelType(e.target.value as FuelType)}
                  className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
                >
                  <option value="PETROL">PETROL</option>
                  <option value="SPEED">SPEED</option>
                  <option value="DIESEL">DIESEL</option>
                  <option value="LUBRICANT">LUBRICANT</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priceRate" className="text-xs font-semibold text-ink-muted">
                  New Rate (₹ per Liter)
                </Label>
                <Input
                  id="priceRate"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 96.50"
                  value={priceRate}
                  onChange={(e) => setPriceRate(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink placeholder:text-ink-subtle"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priceEffective" className="text-xs font-semibold text-ink-muted">
                  Effective Date & Time
                </Label>
                <Input
                  id="priceEffective"
                  type="datetime-local"
                  value={priceEffectiveFrom}
                  onChange={(e) => setPriceEffectiveFrom(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={createPriceMutation.isPending}
                className="w-full bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium text-xs py-2 shadow-md cursor-pointer mt-2"
              >
                {createPriceMutation.isPending ? "Scheduling..." : "Schedule Price Adjustment"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass border-hairline md:col-span-1 p-6 text-center text-xs text-ink-subtle italic">
          Price adjustments are restricted to administrators and managers.
        </Card>
      )}

      {/* Pricing lists grids */}
      <div className="md:col-span-2 space-y-6">
        {/* Active prices mappings card */}
        <Card className="glass border-hairline">
          <CardHeader className="pb-3 border-b border-hairline flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold tracking-tight text-ink">
                Active Price Mappings
              </CardTitle>
              <CardDescription className="text-xs text-ink-subtle">
                Current rates applied automatically on fuel invoice transactions.
              </CardDescription>
            </div>
            {isAdminOrManager && (
              <Button
                type="button"
                variant="outline"
                onClick={() => syncPricesMutation.mutate()}
                disabled={syncPricesMutation.isPending}
                className="text-xs h-8 border-hairline bg-surface-2 hover:bg-surface-3 cursor-pointer shadow-sm text-ink font-semibold"
              >
                {syncPricesMutation.isPending ? "Syncing..." : "Sync Prices"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {activeRatesLoading ? (
              <div className="py-6 text-center text-xs text-ink-subtle">Loading active rates...</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {(["PETROL", "SPEED", "DIESEL", "LUBRICANT"] as FuelType[]).map((ft) => {
                  const rate = activeRates ? activeRates[ft] : 0;
                  return (
                    <Card key={ft} className="bg-surface-2 border border-hairline p-4 flex flex-col justify-between">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">{ft}</p>
                      <div className="flex items-baseline gap-1 mt-2.5">
                        <span className="text-xl font-bold tracking-tight text-ink">
                          ₹{Number(rate).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-ink-subtle">/L</span>
                      </div>
                      <p className="text-[9px] text-success mt-1.5 flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" /> Active
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price Schedule History Card */}
        <Card className="glass border-hairline">
          <CardHeader className="pb-3 border-b border-hairline">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                <TrendingUp size={15} />
              </div>
              <div>
                <CardTitle className="text-base font-bold tracking-tight text-ink">
                  Pricing Schedules & History
                </CardTitle>
                <CardDescription className="text-xs text-ink-subtle">
                  Log of all manual and automated historical fuel rate changes.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {priceSchedulesLoading ? (
              <div className="p-6 text-center text-xs text-ink-subtle">Loading schedules...</div>
            ) : priceSchedules && priceSchedules.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline hover:bg-transparent">
                      <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                        Fuel Type
                      </TableHead>
                      <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                        New Rate
                      </TableHead>
                      <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                        Effective Date & Time
                      </TableHead>
                      <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                        Status
                      </TableHead>
                      {isAdminOrManager && (
                        <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right w-20">
                          Actions
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceSchedules.map((schedule) => {
                      const isApplied = schedule.is_applied || new Date(schedule.effective_from).getTime() <= Date.now();
                      return (
                        <TableRow key={schedule.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                          <TableCell className="px-5 text-xs font-semibold text-ink-muted">
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent">
                              {schedule.fuel_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-ink font-bold font-mono">
                            ₹{Number(schedule.rate).toFixed(2)} / L
                          </TableCell>
                          <TableCell className="text-xs text-ink-muted font-medium">
                            {new Date(schedule.effective_from).toLocaleString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="px-5 text-right">
                            <Badge
                              className={`text-[9px] uppercase font-mono font-bold border-transparent ${
                                isApplied
                                  ? "bg-success/15 text-success hover:bg-success/15"
                                  : "bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15"
                              }`}
                            >
                              {isApplied ? "Applied" : "Scheduled"}
                            </Badge>
                          </TableCell>
                          {isAdminOrManager && (
                            <TableCell className="px-5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedPriceScheduleUuid(schedule.uuid);
                                  setDeletePriceScheduleDialogOpen(true);
                                }}
                                className="text-ink-subtle hover:text-destructive transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer"
                                title="Delete Price Schedule"
                              >
                                <Trash2 size={13} />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-ink-subtle italic">
                No pricing schedules configured yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Price Schedule Confirmation Dialog */}
      <Dialog open={deletePriceScheduleDialogOpen} onOpenChange={setDeletePriceScheduleDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> Delete Price Schedule
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDeletePriceSchedule} className="space-y-4 py-2">
            <p className="text-xs text-ink-muted">
              Are you sure you want to delete this price schedule? This action is permanent and will prevent it from applying to future transactions. It has no effect on past vouchers.
            </p>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletePriceScheduleDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={deletePriceScheduleMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {deletePriceScheduleMutation.isPending ? "Deleting..." : "Delete Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
