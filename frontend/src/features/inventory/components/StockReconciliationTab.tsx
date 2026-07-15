import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Fuel, Plus, Calculator, History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "../services/inventoryService";
import type { FuelType, FuelTankCreate, DipReadingCreate } from "../types";

export default function StockReconciliationTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  // Dialog & Form states
  const [tankDialogOpen, setTankDialogOpen] = useState(false);
  const [tankName, setTankName] = useState("");
  const [tankFuelType, setTankFuelType] = useState<FuelType>("PETROL");
  const [tankCapacity, setTankCapacity] = useState("");
  const [tankInitialStock, setTankInitialStock] = useState("");

  const [selectedTankUuid, setSelectedTankUuid] = useState("");
  const [dipDate, setDipDate] = useState(new Date().toISOString().split("T")[0]);
  const [openingDip, setOpeningDip] = useState("");
  const [closingDip, setClosingDip] = useState("");

  // Queries
  const { data: tanks, isLoading: tanksLoading } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  const { data: dips, isLoading: dipsLoading } = useQuery({
    queryKey: ["dips"],
    queryFn: () => inventoryService.getDips(),
  });

  // Mutations
  const createTankMutation = useMutation({
    mutationFn: (data: FuelTankCreate) => inventoryService.createTank(data),
    onSuccess: () => {
      toast.success("Fuel tank created successfully!");
      setTankDialogOpen(false);
      setTankName("");
      setTankCapacity("");
      setTankInitialStock("");
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create fuel tank.");
    },
  });

  const postDipReadingMutation = useMutation({
    mutationFn: ({ tankUuid, data }: { tankUuid: string; data: DipReadingCreate }) =>
      inventoryService.postDipReading(tankUuid, data),
    onSuccess: () => {
      toast.success("Physical dip reading posted successfully!");
      setOpeningDip("");
      setClosingDip("");
      queryClient.invalidateQueries({ queryKey: ["dips"] });
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to post dip reading.");
    },
  });

  // Submit Handlers
  const handleCreateTank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tankName.trim() || !tankCapacity || !tankInitialStock) {
      toast.error("Please fill in all fuel tank configurations.");
      return;
    }
    createTankMutation.mutate({
      name: tankName,
      fuel_type: tankFuelType,
      capacity_liters: parseFloat(tankCapacity),
      current_stock_liters: parseFloat(tankInitialStock),
    });
  };

  const handlePostDipReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTankUuid || !openingDip || !closingDip) {
      toast.error("Please select a tank and enter dip readings.");
      return;
    }
    postDipReadingMutation.mutate({
      tankUuid: selectedTankUuid,
      data: {
        opening_dip_liters: parseFloat(openingDip),
        closing_dip_liters: parseFloat(closingDip),
        reading_date: dipDate,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Add Button (Mounted inside the main page, but triggers tank dialog) */}
      {isAdminOrManager && (
        <div className="flex justify-end -mt-12 mb-6">
          <Button
            onClick={() => setTankDialogOpen(true)}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15 cursor-pointer"
          >
            <Plus size={16} className="mr-2" /> Add Fuel Tank
          </Button>
        </div>
      )}

      {/* Fuel Tanks section */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5 px-1">
          <Fuel size={14} className="text-fuel-amber" /> Underground Storage Tanks (UST)
        </h3>
        {tanksLoading ? (
          <div className="py-12 text-center text-xs text-ink-subtle">Loading tanks...</div>
        ) : tanks && tanks.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tanks.map((tank) => {
              const pct = Math.min(100, Math.max(0, (tank.current_stock_liters / tank.capacity_liters) * 100));
              return (
                <Card key={tank.uuid} className="glass overflow-hidden border-hairline flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber border-transparent">
                        {tank.fuel_type}
                      </Badge>
                      <span className="text-[10px] font-mono text-ink-subtle">Cap: {tank.capacity_liters.toLocaleString()} L</span>
                    </div>
                    <CardTitle className="text-sm font-bold tracking-tight text-ink mt-2">
                      {tank.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 pb-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-ink-muted">Active Stock:</span>
                      <span className="text-sm font-black font-mono text-ink">
                        {tank.current_stock_liters.toLocaleString(undefined, { minimumFractionDigits: 1 })} L
                      </span>
                    </div>
                    <div className="w-full bg-surface-3 rounded-full h-2 overflow-hidden border border-hairline">
                      <div
                        className="bg-fuel-amber h-2 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-end text-[9px] font-mono text-ink-subtle">
                      {pct.toFixed(0)}% Filled
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-hairline bg-transparent p-12 text-center flex flex-col items-center">
            <Fuel size={32} className="text-ink-subtle mb-3" />
            <h4 className="text-sm font-bold text-ink mb-1">No Fuel Tanks Configured</h4>
            <p className="text-xs text-ink-subtle mb-4">
              Please configure your underground storage tanks to track daily dip reconciliation.
            </p>
            {isAdminOrManager && (
              <Button
                onClick={() => setTankDialogOpen(true)}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas text-xs font-bold shadow-md cursor-pointer"
              >
                Add Fuel Tank
              </Button>
            )}
          </Card>
        )}
      </div>

      {/* Form and Log side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to log dip reading */}
        {isAdminOrManager && tanks && tanks.length > 0 && (
          <Card className="glass border-hairline h-fit">
            <CardHeader className="pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <Calculator size={16} className="text-fuel-amber" />
                <div>
                  <CardTitle className="text-sm font-bold text-ink">Log Daily Dip Reading</CardTitle>
                  <CardDescription className="text-[11px] text-ink-subtle">
                    Record daily physical dips to trace evaporation losses.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <form onSubmit={handlePostDipReading} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dipTankSelect" className="text-xs font-bold text-ink-muted">Select Tank</Label>
                <select
                  id="dipTankSelect"
                  value={selectedTankUuid}
                  onChange={(e) => setSelectedTankUuid(e.target.value)}
                  className="w-full bg-surface-2 border border-hairline rounded-lg outline-none text-sm text-ink px-3 h-10 transition-colors focus:border-fuel-amber"
                  required
                >
                  <option value="">-- Choose Tank --</option>
                  {tanks.map((t) => (
                    <option key={t.uuid} value={t.uuid}>
                      {t.name} ({t.fuel_type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dipDateInput" className="text-xs font-bold text-ink-muted">Logging Date</Label>
                <Input
                  id="dipDateInput"
                  type="date"
                  value={dipDate}
                  onChange={(e) => setDipDate(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink h-9"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="openingDipInput" className="text-xs font-bold text-ink-muted">Opening Dip (L)</Label>
                  <Input
                    id="openingDipInput"
                    type="number"
                    step="0.01"
                    placeholder="Liters"
                    value={openingDip}
                    onChange={(e) => setOpeningDip(e.target.value)}
                    className="bg-surface-2 border-hairline text-xs text-ink h-9"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="closingDipInput" className="text-xs font-bold text-ink-muted">Closing Dip (L)</Label>
                  <Input
                    id="closingDipInput"
                    type="number"
                    step="0.01"
                    placeholder="Liters"
                    value={closingDip}
                    onChange={(e) => setClosingDip(e.target.value)}
                    className="bg-surface-2 border-hairline text-xs text-ink h-9"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={postDipReadingMutation.isPending}
                className="w-full bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer"
              >
                {postDipReadingMutation.isPending ? "Saving..." : "Save Dip Reading"}
              </Button>
            </form>
          </Card>
        )}

        {/* Reconciliation Log Table */}
        <div className={isAdminOrManager && tanks && tanks.length > 0 ? "lg:col-span-2" : "col-span-full"}>
          <Card className="glass border-hairline">
            <CardHeader className="pb-3 border-b border-hairline">
              <div className="flex items-center gap-2">
                <History size={16} className="text-fuel-amber" />
                <div>
                  <CardTitle className="text-sm font-bold text-ink">Reconciliation & Variance Log</CardTitle>
                  <CardDescription className="text-[11px] text-ink-subtle">
                    Historical audit log comparing sales against physical tank drop volumes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dipsLoading ? (
                <div className="p-6 text-center text-xs text-ink-subtle">Loading reconciliation logs...</div>
              ) : dips && dips.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-hairline hover:bg-transparent">
                        <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                          Date
                        </TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                          Tank (Type)
                        </TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                          Opening/Closing Dips
                        </TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                          Dip Drop (Actual Sales)
                        </TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                          Calculated Sales
                        </TableHead>
                        <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                          Variance (L)
                        </TableHead>
                        <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dips.map((dip) => {
                        const tank = tanks?.find((t) => t.id === dip.tank_id);
                        const tankNameStr = tank ? tank.name : `Tank #${dip.tank_id}`;
                        const fuelTypeStr = tank ? tank.fuel_type : "";

                        const actualSales = Math.max(0, dip.opening_dip_liters - dip.closing_dip_liters);
                        const variance = dip.variance_liters;

                        const pct = actualSales > 0 ? (Math.abs(variance) / actualSales) * 100 : 0;
                        const isHighLoss = variance < 0 && pct > 1.0;

                        let statusBadge = (
                          <Badge className="text-[8px] px-1.5 py-0 bg-success/15 text-success hover:bg-success/15 border-transparent font-bold">
                            NORMAL
                          </Badge>
                        );
                        if (variance > 0) {
                          statusBadge = (
                            <Badge className="text-[8px] px-1.5 py-0 bg-blue-500/15 text-blue-500 hover:bg-blue-500/15 border-transparent font-bold">
                              GAIN (+{variance.toFixed(1)}L)
                            </Badge>
                          );
                        } else if (isHighLoss) {
                          statusBadge = (
                            <Badge className="text-[8px] px-1.5 py-0 bg-red-500/15 text-red-500 hover:bg-red-500/15 border-transparent font-bold">
                              ⚠️ LOSS HIGHER
                            </Badge>
                          );
                        } else if (variance < 0) {
                          statusBadge = (
                            <Badge className="text-[8px] px-1.5 py-0 bg-amber-500/15 text-amber-500 hover:bg-amber-500/15 border-transparent font-bold">
                              LOSS (-{Math.abs(variance).toFixed(1)}L)
                            </Badge>
                          );
                        }

                        return (
                          <TableRow key={dip.uuid} className="border-b border-hairline hover:bg-surface-3/15 font-mono">
                            <TableCell className="px-5 text-xs text-ink-muted">
                              {new Date(dip.reading_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-ink">
                              {tankNameStr} {fuelTypeStr && (
                                <Badge className="text-[8px] px-1 py-0 ml-1.5 bg-fuel-amber/10 text-fuel-amber border-transparent">
                                  {fuelTypeStr}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted">
                              {dip.opening_dip_liters.toFixed(1)} L → {dip.closing_dip_liters.toFixed(1)} L
                            </TableCell>
                            <TableCell className="text-xs text-ink font-semibold text-right">
                              {actualSales.toFixed(1)} L
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted text-right">
                              {dip.actual_sales_from_vouchers.toFixed(1)} L
                            </TableCell>
                            <TableCell className={`text-xs text-right font-bold ${variance < 0 ? "text-red-500" : "text-blue-500"}`}>
                              {variance > 0 ? "+" : ""}{variance.toFixed(2)} L
                            </TableCell>
                            <TableCell className="px-5 text-right">
                              {statusBadge}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-12 text-center text-xs text-ink-subtle italic">
                  No physical dip readings reconciliation logs recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Fuel Tank Dialog */}
      <Dialog open={tankDialogOpen} onOpenChange={setTankDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Fuel size={18} className="text-fuel-amber" /> Create Fuel Tank
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTank} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tankNameInput" className="text-xs font-bold text-ink-muted">Tank Name</Label>
              <Input
                id="tankNameInput"
                placeholder="e.g. Tank A - Diesel Main"
                value={tankName}
                onChange={(e) => setTankName(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tankFuelTypeSelect" className="text-xs font-bold text-ink-muted">Fuel Type</Label>
                <select
                  id="tankFuelTypeSelect"
                  value={tankFuelType}
                  onChange={(e) => setTankFuelType(e.target.value as FuelType)}
                  className="w-full bg-surface-2 border border-hairline rounded-lg outline-none text-sm text-ink px-3 h-10 transition-colors focus:border-fuel-amber"
                  required
                >
                  <option value="PETROL">PETROL</option>
                  <option value="SPEED">SPEED</option>
                  <option value="DIESEL">DIESEL</option>
                  <option value="LUBRICANT">LUBRICANT</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tankCapacityInput" className="text-xs font-bold text-ink-muted">Capacity (Liters)</Label>
                <Input
                  id="tankCapacityInput"
                  type="number"
                  placeholder="e.g. 20000"
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tankInitialStockInput" className="text-xs font-bold text-ink-muted">Initial Stock (Liters)</Label>
              <Input
                id="tankInitialStockInput"
                type="number"
                placeholder="e.g. 15000"
                value={tankInitialStock}
                onChange={(e) => setTankInitialStock(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
                required
              />
            </div>

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTankDialogOpen(false)}
                className="text-xs h-9 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTankMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer"
              >
                {createTankMutation.isPending ? "Creating..." : "Create Fuel Tank"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
