import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Fuel, Plus, PlusCircle, Calculator, History, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "../services/inventoryService";
import type { FuelType, FuelTankCreate, DipReadingCreate } from "../types";
import TankVisualization from "./TankVisualization";

export default function StockReconciliationTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  // Dialog & Form states
  const [tankDialogOpen, setTankDialogOpen] = useState(false);
  const [tankName, setTankName] = useState("");
  const [tankFuelType, setTankFuelType] = useState<FuelType>("PETROL");
  const [tankCapacity, setTankCapacity] = useState("");
  const [tankInitialStock, setTankInitialStock] = useState("");
  const [tallyGodownName, setTallyGodownName] = useState("");

  const [editTankDialogOpen, setEditTankDialogOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<any>(null);
  const [editTankName, setEditTankName] = useState("");
  const [editTankFuelType, setEditTankFuelType] = useState<FuelType>("PETROL");
  const [editTankCapacity, setEditTankCapacity] = useState("");
  const [editTankCurrentStock, setEditTankCurrentStock] = useState("");
  const [editTallyGodownName, setEditTallyGodownName] = useState("");
  const [editIgnoreCapacity, setEditIgnoreCapacity] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTank, setDeletingTank] = useState<any>(null);

  const [selectedTankUuid, setSelectedTankUuid] = useState("");
  const [dipDate, setDipDate] = useState(new Date().toISOString().split("T")[0]);
  const [openingDip, setOpeningDip] = useState("");
  const [closingDip, setClosingDip] = useState("");

  // Add Stock (tanker delivery) states
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [stockTank, setStockTank] = useState<any>(null);
  const [stockDate, setStockDate] = useState(new Date().toISOString().split("T")[0]);
  const [stockQty, setStockQty] = useState("");
  const [stockInvoice, setStockInvoice] = useState("");
  const [stockSupplier, setStockSupplier] = useState("");
  const [stockProcurementRate, setStockProcurementRate] = useState("");
  const [stockPaymentMode, setStockPaymentMode] = useState<string>("CREDIT");
  const [stockIgnoreCapacity, setStockIgnoreCapacity] = useState(false);

  // Queries
  const {
    data: tanks,
    isLoading: tanksLoading,
    isError: tanksError,
    error: tanksErrorObj,
    refetch: refetchTanks,
  } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  const {
    data: dips,
    isLoading: dipsLoading,
    isError: dipsError,
    error: dipsErrorObj,
    refetch: refetchDips,
  } = useQuery({
    queryKey: ["dips"],
    queryFn: () => inventoryService.getDips(),
  });

  const {
    data: forecasts,
  } = useQuery({
    queryKey: ["tank-forecasts"],
    queryFn: () => inventoryService.getTankForecasts(),
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
      queryClient.invalidateQueries({ queryKey: ["tank-forecasts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create fuel tank.");
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: (data: {
      tank_uuid: string;
      delivery_date: string;
      quantity_liters: number;
      invoice_number?: string;
      supplier_name?: string;
      procurement_rate?: number;
      payment_mode?: string;
      ignore_capacity?: boolean;
    }) => inventoryService.createDelivery(data),
    onSuccess: () => {
      toast.success("Stock added to tank successfully!");
      setAddStockOpen(false);
      setStockQty("");
      setStockInvoice("");
      setStockSupplier("");
      setStockProcurementRate("");
      setStockPaymentMode("CREDIT");
      setStockIgnoreCapacity(false);
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["tank-forecasts"] });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || "Failed to add stock.";
      // Backend flags an over-capacity delivery with a distinct CAPACITY_WARNING prefix.
      if (typeof detail === "string" && detail.includes("CAPACITY_WARNING")) {
        toast.error("This delivery would exceed the tank capacity. Tick 'Fill beyond capacity' to override.");
      } else {
        toast.error(detail);
      }
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
      queryClient.invalidateQueries({ queryKey: ["tank-forecasts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to post dip reading.");
    },
  });

  const updateTankMutation = useMutation({
    mutationFn: ({ tankUuid, data }: { tankUuid: string; data: Partial<FuelTankCreate> & { ignore_capacity?: boolean } }) =>
      inventoryService.updateTank(tankUuid, data),
    onSuccess: () => {
      toast.success("Fuel tank updated successfully!");
      setEditTankDialogOpen(false);
      setEditingTank(null);
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["tank-forecasts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update fuel tank.");
    },
  });

  const deleteTankMutation = useMutation({
    mutationFn: (tankUuid: string) => inventoryService.deleteTank(tankUuid),
    onSuccess: () => {
      toast.success("Fuel tank deleted successfully!");
      setDeleteConfirmOpen(false);
      setDeletingTank(null);
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["tank-forecasts"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to delete fuel tank.");
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
      tally_godown_name: tallyGodownName.trim() || undefined,
    });
  };

  const handleOpenAddStock = (tank: any) => {
    setStockTank(tank);
    setStockDate(new Date().toISOString().split("T")[0]);
    setStockQty("");
    setStockInvoice("");
    setStockSupplier("");
    setStockProcurementRate("");
    setStockPaymentMode("CREDIT");
    setStockIgnoreCapacity(false);
    setAddStockOpen(true);
  };

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockTank) return;
    const qty = parseFloat(stockQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Enter a delivery quantity greater than zero.");
      return;
    }
    const rate = stockProcurementRate.trim() ? parseFloat(stockProcurementRate) : undefined;
    createDeliveryMutation.mutate({
      tank_uuid: stockTank.uuid,
      delivery_date: stockDate,
      quantity_liters: qty,
      invoice_number: stockInvoice.trim() || undefined,
      supplier_name: stockSupplier.trim() || undefined,
      procurement_rate: rate,
      payment_mode: stockPaymentMode,
      ignore_capacity: stockIgnoreCapacity,
    });
  };

  const handleOpenEdit = (tank: any) => {
    setEditingTank(tank);
    setEditTankName(tank.name);
    setEditTankFuelType(tank.fuel_type);
    setEditTankCapacity(String(tank.capacity_liters));
    setEditTankCurrentStock(String(tank.current_stock_liters));
    setEditTallyGodownName(tank.tally_godown_name || "");
    setEditIgnoreCapacity(false);
    setEditTankDialogOpen(true);
  };

  const handleOpenDelete = (tank: any) => {
    setDeletingTank(tank);
    setDeleteConfirmOpen(true);
  };

  const handleUpdateTank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTank) return;
    if (!editTankName.trim() || !editTankCapacity || !editTankCurrentStock) {
      toast.error("Please fill in all fuel tank configurations.");
      return;
    }
    updateTankMutation.mutate({
      tankUuid: editingTank.uuid,
      data: {
        name: editTankName,
        fuel_type: editTankFuelType,
        capacity_liters: parseFloat(editTankCapacity),
        current_stock_liters: parseFloat(editTankCurrentStock),
        tally_godown_name: editTallyGodownName.trim() || null,
        ignore_capacity: editIgnoreCapacity,
      },
    });
  };

  const handleDeleteTank = () => {
    if (!deletingTank) return;
    deleteTankMutation.mutate(deletingTank.uuid);
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

  // Derive negative stock tanks
  const negativeTanks = tanks?.filter((t) => t.current_stock_liters < 0) || [];

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

      {/* Negative Stock Warning Banner */}
      {negativeTanks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl flex items-start gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Negative Stock Alert</h4>
            <p className="text-[11px] opacity-90 leading-relaxed">
              The following tanks have negative stock levels, indicating potential timing/ordering errors in recording physical deliveries:
            </p>
            <ul className="list-disc pl-5 text-[11px] space-y-0.5 font-bold mt-1.5">
              {negativeTanks.map((t) => (
                <li key={t.uuid}>
                  {t.name} ({t.fuel_type}): {t.current_stock_liters.toLocaleString(undefined, { minimumFractionDigits: 1 })} L
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Forecast Run-out Warnings */}
      {forecasts && forecasts.filter(f => f.days_until_empty !== null && f.days_until_empty <= 3.0).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Run-out Forecast Warning</h4>
            <p className="text-[11px] opacity-90 leading-relaxed">
              The following tanks are projected to run dry within 3 days based on the average daily sales from the past 7 days:
            </p>
            <ul className="list-disc pl-5 text-[11px] space-y-0.5 font-bold mt-1.5">
              {forecasts.filter(f => f.days_until_empty !== null && f.days_until_empty <= 3.0).map(f => (
                <li key={f.tank_uuid}>
                  {f.tank_name} ({f.fuel_type}): Projected empty in <span className="underline font-black">{f.days_until_empty} days</span> (avg daily sales: {f.avg_daily_sales.toFixed(1)} L/day)
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Fuel Tanks section */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted font-bold flex items-center gap-1.5 px-1">
          <Fuel size={14} className="text-fuel-amber" /> Underground Storage Tanks (UST)
        </h3>
        {tanksLoading ? (
          <div className="py-12 text-center text-xs text-ink-subtle">Loading tanks...</div>
        ) : tanksError ? (
          <div className="py-12 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-fuel-amber">
              <AlertTriangle size={16} />
              <p className="text-xs font-semibold">Couldn't load fuel tanks.</p>
            </div>
            <p className="text-[11px] text-ink-subtle max-w-md mx-auto">
              {(tanksErrorObj as any)?.response?.data?.detail ||
                "The server rejected this request. This is a loading error, not a missing setup."}
            </p>
            <button
              type="button"
              onClick={() => refetchTanks()}
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs px-3 py-1.5 rounded cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : tanks && tanks.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tanks.map((tank) => {
              return (
                <Card key={tank.uuid} className="glass overflow-hidden border-hairline flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber border-transparent">
                        {tank.fuel_type}
                      </Badge>
                      <span className="text-[10px] font-mono text-ink-subtle">Cap: {tank.capacity_liters.toLocaleString()} L</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <CardTitle className="text-sm font-bold tracking-tight text-ink">
                        {tank.name}
                      </CardTitle>
                      {isAdminOrManager && (
                        <div className="flex items-center gap-1.5 no-print">
                          <button
                            type="button"
                            onClick={() => handleOpenAddStock(tank)}
                            className="p-1 text-ink-subtle hover:text-fuel-amber hover:bg-surface-3 rounded transition-colors cursor-pointer"
                            title="Add Stock (Tanker Delivery)"
                          >
                            <Plus size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(tank)}
                            className="p-1 text-ink-subtle hover:text-fuel-amber hover:bg-surface-3 rounded transition-colors cursor-pointer"
                            title="Edit Tank"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(tank)}
                            className="p-1 text-ink-subtle hover:text-red-400 hover:bg-surface-3 rounded transition-colors cursor-pointer"
                            title="Delete Tank"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 pb-4 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-ink-muted">Active Stock:</span>
                      <span className="text-sm font-black font-mono text-ink">
                        {tank.current_stock_liters.toLocaleString(undefined, { minimumFractionDigits: 1 })} L
                      </span>
                    </div>
                    {tank.tally_godown_name && (
                      <div className="flex items-baseline justify-between text-[10px] text-ink-subtle">
                        <span>Tally Godown:</span>
                        <span className="font-mono font-bold text-fuel-amber">{tank.tally_godown_name}</span>
                      </div>
                    )}

                    {/* SVG Interactive Tank Visualizer */}
                    {(() => {
                      const forecast = forecasts?.find((f) => f.tank_uuid === tank.uuid);
                      const daysLeft = forecast ? forecast.days_until_empty : null;
                      const avgSales = forecast ? forecast.avg_daily_sales : 0;

                      return (
                        <>
                          <TankVisualization
                            fuelType={tank.fuel_type}
                            capacityLiters={tank.capacity_liters}
                            currentStockLiters={tank.current_stock_liters}
                            daysUntilEmpty={daysLeft}
                          />

                          <div className="mt-2.5 flex items-center justify-between text-xs border-t border-hairline/45 pt-2.5">
                            <span className="text-ink-muted">Run-out Forecast:</span>
                            <span
                              className={`font-mono font-bold ${
                                daysLeft !== null && daysLeft <= 3
                                  ? "text-red-500 font-black animate-pulse"
                                  : "text-ink"
                              }`}
                            >
                              {daysLeft !== null ? `${daysLeft} days` : "No sales history"}
                            </span>
                          </div>

                          {daysLeft !== null && (
                            <div className="text-[10px] text-ink-subtle flex justify-between font-mono mt-0.5">
                              <span>Daily Demand (7d):</span>
                              <span>{avgSales.toLocaleString(undefined, { maximumFractionDigits: 1 })} L/day</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
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
              ) : dipsError ? (
                <div className="p-12 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-fuel-amber">
                    <AlertTriangle size={16} />
                    <p className="text-xs font-semibold">Couldn't load reconciliation logs.</p>
                  </div>
                  <p className="text-[11px] text-ink-subtle max-w-md mx-auto">
                    {(dipsErrorObj as any)?.response?.data?.detail ||
                      "The server rejected this request. This is a loading error, not a missing setup."}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetchDips()}
                    className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs px-3 py-1.5 rounded cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
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
                          <TableRow key={dip.uuid} className="border-b border-hairline pl-row font-mono">
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
                            <TableCell className="text-xs text-ink-muted pl-numeric">
                              {dip.opening_dip_liters.toFixed(1)} L → {dip.closing_dip_liters.toFixed(1)} L
                            </TableCell>
                            <TableCell className="text-xs text-ink font-semibold text-right pl-numeric">
                              {actualSales.toFixed(1)} L
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted text-right pl-numeric">
                              {dip.actual_sales_from_vouchers.toFixed(1)} L
                            </TableCell>
                            <TableCell className={`text-xs text-right font-bold pl-numeric ${variance < 0 ? "text-red-500" : "text-blue-500"}`}>
                              {variance > 0 ? "+" : variance < 0 ? "" : " "}{variance.toFixed(2)} L
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

            <div className="space-y-1.5">
              <Label htmlFor="tankTallyGodownInput" className="text-xs font-bold text-ink-muted">Tally Godown Name <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                id="tankTallyGodownInput"
                placeholder="e.g. Underground Tank 1"
                value={tallyGodownName}
                onChange={(e) => setTallyGodownName(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
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

      {/* Add Stock (Tanker Delivery) Dialog */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <PlusCircle size={18} className="text-fuel-amber" /> Add Stock
              {stockTank && <span className="text-ink-muted font-normal">— {stockTank.name}</span>}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-ink-subtle">
              Record a tanker delivery. This adds to the tank's current stock.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddStock} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stockDateInput" className="text-xs font-bold text-ink-muted">Delivery Date</Label>
                <Input
                  id="stockDateInput"
                  type="date"
                  value={stockDate}
                  onChange={(e) => setStockDate(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink h-9"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stockQtyInput" className="text-xs font-bold text-ink-muted">Quantity (Liters)</Label>
                <Input
                  id="stockQtyInput"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 20000"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stockInvoiceInput" className="text-xs font-bold text-ink-muted">Invoice / DC No. <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                id="stockInvoiceInput"
                placeholder="e.g. INV-2024-001"
                value={stockInvoice}
                onChange={(e) => setStockInvoice(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stockSupplierInput" className="text-xs font-bold text-ink-muted">Supplier <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                id="stockSupplierInput"
                placeholder="e.g. IOCL Depot"
                value={stockSupplier}
                onChange={(e) => setStockSupplier(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stockProcurementRateInput" className="text-xs font-bold text-ink-muted">Procurement Rate (₹/Liter) <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                id="stockProcurementRateInput"
                type="number"
                step="0.01"
                placeholder="e.g. 84.50"
                value={stockProcurementRate}
                onChange={(e) => setStockProcurementRate(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stockPaymentModeInput" className="text-xs font-bold text-ink-muted">Payment Mode</Label>
              <select
                id="stockPaymentModeInput"
                value={stockPaymentMode}
                onChange={(e) => setStockPaymentMode(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-xs text-ink h-9 focus:outline-none transition cursor-pointer"
              >
                <option value="CREDIT">CREDIT (Pay Later / Due)</option>
                <option value="CASH">CASH</option>
                <option value="UPI">UPI</option>
                <option value="CARD">CARD</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-[11px] text-ink-muted cursor-pointer">
              <input
                type="checkbox"
                checked={stockIgnoreCapacity}
                onChange={(e) => setStockIgnoreCapacity(e.target.checked)}
                className="cursor-pointer"
              />
              Fill beyond capacity (override capacity check)
            </label>

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddStockOpen(false)}
                className="text-xs h-9 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDeliveryMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer"
              >
                {createDeliveryMutation.isPending ? "Adding..." : "Add Stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Fuel Tank Dialog */}
      <Dialog open={editTankDialogOpen} onOpenChange={setEditTankDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Fuel size={18} className="text-fuel-amber" /> Edit Fuel Tank
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateTank} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editTankNameInput" className="text-xs font-bold text-ink-muted">Tank Name</Label>
              <Input
                id="editTankNameInput"
                placeholder="e.g. Tank A - Diesel Main"
                value={editTankName}
                onChange={(e) => setEditTankName(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="editTankFuelTypeSelect" className="text-xs font-bold text-ink-muted">Fuel Type</Label>
                <select
                  id="editTankFuelTypeSelect"
                  value={editTankFuelType}
                  onChange={(e) => setEditTankFuelType(e.target.value as FuelType)}
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
                <Label htmlFor="editTankCapacityInput" className="text-xs font-bold text-ink-muted">Capacity (Liters)</Label>
                <Input
                  id="editTankCapacityInput"
                  type="number"
                  placeholder="e.g. 20000"
                  value={editTankCapacity}
                  onChange={(e) => setEditTankCapacity(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editTankCurrentStockInput" className="text-xs font-bold text-ink-muted">Current Stock (Liters)</Label>
              <Input
                id="editTankCurrentStockInput"
                type="number"
                placeholder="e.g. 15000"
                value={editTankCurrentStock}
                onChange={(e) => setEditTankCurrentStock(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editTankTallyGodownInput" className="text-xs font-bold text-ink-muted">Tally Godown Name <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                id="editTankTallyGodownInput"
                placeholder="e.g. Underground Tank 1"
                value={editTallyGodownName}
                onChange={(e) => setEditTallyGodownName(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
              />
            </div>

            {parseFloat(editTankCapacity) < parseFloat(editTankCurrentStock) && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-2.5 rounded-lg text-[11px] flex items-start gap-2 mt-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Capacity Warning</p>
                  <p className="opacity-90">The new capacity is below the current stock level. Please check the stock or verify the ignore checkbox below.</p>
                  <label className="flex items-center gap-1.5 mt-2 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editIgnoreCapacity}
                      onChange={(e) => setEditIgnoreCapacity(e.target.checked)}
                      className="rounded accent-red-500 h-3.5 w-3.5"
                    />
                    Ignore capacity validation (Force save)
                  </label>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditTankDialogOpen(false)}
                className="text-xs h-9 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateTankMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer"
              >
                {updateTankMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Fuel Tank Confirm Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={16} /> Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-xs text-ink-muted leading-relaxed">
            Are you sure you want to delete the fuel tank <strong className="text-ink">"{deletingTank?.name}"</strong>?
            <p className="mt-2 text-[11px] text-red-500/90 bg-red-500/5 p-2 rounded border border-red-500/10">
              <strong>Important:</strong> This will disassociate referencing nozzles. Historical delivery and physical dip records will be preserved for audits.
            </p>
          </div>
          <DialogFooter className="pt-3 border-t border-hairline">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteConfirmOpen(false)}
              className="text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteTank}
              disabled={deleteTankMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-canvas font-bold text-xs h-9 cursor-pointer"
            >
              {deleteTankMutation.isPending ? "Deleting..." : "Delete Tank"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
