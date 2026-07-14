import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Fuel,
  Plus,
  Calculator,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Activity,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import EmptyState from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import inventoryService from "./services/inventoryService";
import type { FuelType, PriceScheduleCreate, FuelDispenserCreate, NozzleCreate, BulkNozzleReadingCreate } from "./types";

export default function InventoryPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"dispensers" | "readings" | "prices">("dispensers");

  // Dispensers and Nozzles state
  const [dispenserDialogOpen, setDispenserDialogOpen] = useState(false);
  const [nozzleDialogOpen, setNozzleDialogOpen] = useState(false);
  const [selectedDispenserUuid, setSelectedDispenserUuid] = useState("");

  const [dispenserName, setDispenserName] = useState("");
  
  const [nozzleName, setNozzleName] = useState("");
  const [nozzleFuelType, setNozzleFuelType] = useState<FuelType>("PETROL");
  const [nozzleInitialReading, setNozzleInitialReading] = useState("");

  // Meter Readings Bulk Entry state
  const [readingsDate, setReadingsDate] = useState(new Date().toISOString().split("T")[0]);
  const [formItems, setFormItems] = useState<Record<string, { opening: string | number; closing: string | number }>>({});

  // Price Schedule Form states
  const [priceFuelType, setPriceFuelType] = useState<FuelType>("PETROL");
  const [priceRate, setPriceRate] = useState("");
  const [priceEffectiveFrom, setPriceEffectiveFrom] = useState(
    new Date(Date.now() + 60000).toISOString().slice(0, 16)
  );

  // Queries
  const { data: dispensers, isLoading: dispensersLoading, isError: dispensersError } = useQuery({
    queryKey: ["dispensers"],
    queryFn: () => inventoryService.getDispensers(),
  });

  const { data: bulkForm, isLoading: bulkFormLoading } = useQuery({
    queryKey: ["bulkReadings", readingsDate],
    queryFn: () => inventoryService.getBulkReadingsForm(readingsDate),
    enabled: activeTab === "readings",
  });

  // Sync bulk reading form items into local state when data is loaded
  useEffect(() => {
    if (bulkForm?.items) {
      const initialMap: Record<string, { opening: string | number; closing: string | number }> = {};
      bulkForm.items.forEach((item) => {
        initialMap[item.nozzle_uuid] = {
          opening: item.opening_reading,
          closing: item.closing_reading !== null ? item.closing_reading : "",
        };
      });
      setFormItems(initialMap);
    }
  }, [bulkForm]);

  // Mutations
  const createDispenserMutation = useMutation({
    mutationFn: (data: FuelDispenserCreate) => inventoryService.createDispenser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      setDispenserDialogOpen(false);
      setDispenserName("");
      toast.success("Fuel dispenser configured successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to configure fuel dispenser.";
      toast.error(msg);
      console.error(err);
    },
  });

  const createNozzleMutation = useMutation({
    mutationFn: ({ dispenserUuid, data }: { dispenserUuid: string; data: NozzleCreate }) =>
      inventoryService.createNozzle(dispenserUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      setNozzleDialogOpen(false);
      setNozzleName("");
      setNozzleInitialReading("");
      toast.success("Nozzle configured successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to configure nozzle.";
      toast.error(msg);
      console.error(err);
    },
  });

  const postBulkReadingsMutation = useMutation({
    mutationFn: (data: BulkNozzleReadingCreate) => inventoryService.postBulkReadings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      queryClient.invalidateQueries({ queryKey: ["bulkReadings", readingsDate] });
      toast.success("All nozzle meter readings saved successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to save meter readings.";
      toast.error(msg);
      console.error(err);
    },
  });

  const createPriceMutation = useMutation({
    mutationFn: (data: PriceScheduleCreate) => inventoryService.createPriceSchedule(data),
    onSuccess: () => {
      toast.success("Fuel price schedule added successfully!");
      setPriceRate("");
    },
    onError: (err) => {
      toast.error("Failed to create price schedule.");
      console.error(err);
    },
  });

  // Form Submissions
  const handleCreateDispenser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenserName.trim()) {
      toast.error("Please fill in dispenser name.");
      return;
    }
    createDispenserMutation.mutate({ name: dispenserName });
  };

  const handleCreateNozzle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nozzleName.trim() || !nozzleInitialReading) {
      toast.error("Please fill in all nozzle configurations.");
      return;
    }
    createNozzleMutation.mutate({
      dispenserUuid: selectedDispenserUuid,
      data: {
        name: nozzleName,
        fuel_type: nozzleFuelType,
        last_reading: parseFloat(nozzleInitialReading),
      },
    });
  };

  const handleSaveBulkReadings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const readings = Object.entries(formItems).map(([uuid, vals]) => {
        const closingStr = vals.closing.toString().trim();
        if (!closingStr) {
          throw new Error("Please specify closing readings for all nozzles.");
        }
        const closing = parseFloat(closingStr);
        const opening = vals.opening !== "" ? parseFloat(vals.opening.toString()) : 0;
        
        if (closing < opening) {
          const item = bulkForm?.items.find((i) => i.nozzle_uuid === uuid);
          throw new Error(
            `Closing reading (${closing}) on nozzle '${item?.nozzle_name || "Unknown"}' cannot be less than opening reading (${opening}).`
          );
        }

        return {
          nozzle_uuid: uuid,
          opening_reading: vals.opening !== "" ? parseFloat(vals.opening.toString()) : undefined,
          closing_reading: closing,
        };
      });

      postBulkReadingsMutation.mutate({
        reading_date: readingsDate,
        readings,
      });
    } catch (err: any) {
      toast.error(err.message || "Invalid input readings.");
    }
  };

  const handleCreatePriceSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceRate || !priceEffectiveFrom) {
      toast.error("Please specify a rate and effective timestamp.");
      return;
    }
    createPriceMutation.mutate({
      fuel_type: priceFuelType,
      rate: parseFloat(priceRate),
      effective_from: new Date(priceEffectiveFrom).toISOString(),
    });
  };

  if (dispensersLoading) {
    return <LoadingState />;
  }

  if (dispensersError) {
    return <EmptyState message="Unable to load dispenser inventory data." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Inventory & Pricing"
          description="Configure dispensers, perform bulk meter entries, and manage scheduled fuel rate structures."
        />
        {isAdminOrManager && (
          <div className="flex gap-2">
            {activeTab === "dispensers" && (
              <Button
                onClick={() => setDispenserDialogOpen(true)}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15 cursor-pointer"
              >
                <Plus size={16} className="mr-2" /> Add Fuel Dispenser
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-hairline gap-4">
        <button
          onClick={() => setActiveTab("dispensers")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "dispensers"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Fuel Dispensers
        </button>
        <button
          onClick={() => setActiveTab("readings")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "readings"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Meter Readings
        </button>
        <button
          onClick={() => setActiveTab("prices")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "prices"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Price Schedules
        </button>
      </div>

      {activeTab === "dispensers" ? (
        <div className="space-y-8 animate-fade-in">
          {/* Dispensers Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {dispensers && dispensers.length > 0 ? (
              dispensers.map((dispenser) => (
                <Card key={dispenser.uuid} className="glass overflow-hidden relative border-hairline flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className="bg-fuel-amber/10 text-fuel-amber text-[10px] uppercase font-mono font-bold"
                      >
                        {dispenser.status}
                      </Badge>
                      <Fuel size={18} className="text-ink-subtle" />
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight text-ink mt-2">
                      {dispenser.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-ink-subtle">
                      Dispenser Machine with {dispenser.nozzles?.length || 0}/4 configured nozzles
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 flex-grow flex flex-col justify-between space-y-4">
                    {/* Nozzle list inside dispenser */}
                    <div className="space-y-2">
                      {dispenser.nozzles && dispenser.nozzles.length > 0 ? (
                        <div className="grid gap-2">
                          {dispenser.nozzles.map((nozzle) => (
                            <div
                              key={nozzle.uuid}
                              className="bg-surface-2 p-2.5 rounded-lg border border-hairline flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-bold text-ink">{nozzle.name}</p>
                                <p className="text-[10px] text-ink-subtle mt-0.5">
                                  Last Meter: {nozzle.last_reading.toLocaleString()} L
                                </p>
                              </div>
                              <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber border-transparent hover:bg-fuel-amber/15">
                                {nozzle.fuel_type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-subtle italic text-center py-2">
                          No nozzles configured on this dispenser machine.
                        </p>
                      )}
                    </div>

                    {isAdminOrManager && (dispenser.nozzles?.length || 0) < 4 && (
                      <Button
                        onClick={() => {
                          setSelectedDispenserUuid(dispenser.uuid);
                          setNozzleDialogOpen(true);
                        }}
                        variant="outline"
                        className="w-full justify-center border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
                      >
                        <Plus size={14} className="mr-2 text-fuel-amber" /> Configure Nozzle
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full">
                <Card className="border-dashed border-hairline bg-transparent p-6 text-center">
                  <Fuel className="mx-auto text-ink-subtle mb-3" size={32} />
                  <p className="text-sm font-medium text-ink">No fuel dispensers configured.</p>
                  <p className="text-xs text-ink-subtle mt-1">
                    Click "Add Fuel Dispenser" to initialize pump configuration.
                  </p>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === "readings" ? (
        <div className="space-y-6 animate-fade-in">
          {/* Header toolbar for bulk entries */}
          <Card className="glass border-hairline p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                <Activity size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Unified Data Entry Log</h3>
                <p className="text-xs text-ink-subtle">
                  Batch submit initial and final readings for all active dispensers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bulkDateInput" className="text-xs font-semibold text-ink-muted shrink-0">
                Logging Date:
              </Label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer transition-colors"
                  size={14}
                  onClick={() => {
                    const el = document.getElementById("bulkDateInput") as HTMLInputElement | null;
                    if (el && typeof el.showPicker === "function") {
                      el.showPicker();
                    }
                  }}
                />
                <Input
                  id="bulkDateInput"
                  type="date"
                  value={readingsDate}
                  onChange={(e) => setReadingsDate(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-xs text-ink pl-9 py-1 h-8 w-36"
                  required
                />
              </div>
            </div>
          </Card>

          {/* Bulk Spreadsheet Table */}
          <form onSubmit={handleSaveBulkReadings}>
            <Card className="glass border-hairline">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  {bulkFormLoading ? (
                    <div className="p-12 text-center text-xs text-ink-subtle">
                      Loading meter entry form...
                    </div>
                  ) : bulkForm && bulkForm.items.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-hairline hover:bg-transparent">
                          <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                            Dispenser
                          </TableHead>
                          <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                            Nozzle Name
                          </TableHead>
                          <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                            Fuel Type
                          </TableHead>
                          <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-40">
                            Initial Reading (L)
                          </TableHead>
                          <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-44">
                            Final Reading (L)
                          </TableHead>
                          <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right w-36">
                            Sales (Liters)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkForm.items.map((item) => {
                          const stateVals = formItems[item.nozzle_uuid] || { opening: "", closing: "" };
                          const openVal = parseFloat(stateVals.opening.toString() || "0");
                          const closeVal = parseFloat(stateVals.closing.toString() || "0");
                          const salesAmt = closeVal >= openVal && stateVals.closing !== "" ? closeVal - openVal : 0;

                          return (
                            <TableRow key={item.nozzle_uuid} className="border-b border-hairline hover:bg-surface-3/35">
                              <TableCell className="px-5 text-xs font-bold text-ink">
                                {item.dispenser_name}
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-ink-muted">
                                {item.nozzle_name}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-ink-muted">
                                <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent">
                                  {item.fuel_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={stateVals.opening}
                                  onChange={(e) => {
                                    setFormItems((prev) => ({
                                      ...prev,
                                      [item.nozzle_uuid]: {
                                        ...prev[item.nozzle_uuid],
                                        opening: e.target.value,
                                      },
                                    }));
                                  }}
                                  className="w-32 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8"
                                  required
                                />
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Enter final reading"
                                  value={stateVals.closing}
                                  onChange={(e) => {
                                    setFormItems((prev) => ({
                                      ...prev,
                                      [item.nozzle_uuid]: {
                                        ...prev[item.nozzle_uuid],
                                        closing: e.target.value,
                                      },
                                    }));
                                  }}
                                  className="w-36 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8"
                                  required
                                />
                              </TableCell>
                              <TableCell className="px-5 text-right font-semibold text-xs text-ink">
                                {salesAmt > 0 ? `${salesAmt.toFixed(2)} L` : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-12 text-center text-xs text-ink-subtle">
                      No nozzles configured. Please configure dispensers and nozzles in the first tab.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {isAdminOrManager && bulkForm && bulkForm.items.length > 0 && (
              <div className="flex justify-end mt-4">
                <Button
                  type="submit"
                  disabled={postBulkReadingsMutation.isPending}
                  className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-6 py-2 shadow-md cursor-pointer"
                >
                  {postBulkReadingsMutation.isPending ? "Saving batch..." : "Save All Readings"}
                </Button>
              </div>
            )}
          </form>
        </div>
      ) : (
        /* Prices Schedules Tab */
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
                      <option value="SPEED_PETROL">SPEED PETROL</option>
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
                    className="w-full bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium text-xs py-2 shadow-md cursor-pointer mt-2"
                  >
                    Add Pricing Schedule
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass border-hairline md:col-span-1 p-6 text-center">
              <AlertTriangle className="mx-auto text-fuel-amber mb-2" size={24} />
              <p className="text-xs text-ink font-semibold">Access Restricted</p>
              <p className="text-[11px] text-ink-subtle mt-1">
                You do not have permission to modify pricing schedules.
              </p>
            </Card>
          )}

          {/* Active rates & Schedules list */}
          <div className="md:col-span-2 space-y-6">
            <Card className="glass border-hairline">
              <CardHeader className="pb-3 border-b border-hairline">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                    <Calendar size={15} />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold tracking-tight text-ink">
                      Active Price Mappings
                    </CardTitle>
                    <CardDescription className="text-xs text-ink-subtle">
                      Current rates applied automatically on fuel invoice transactions.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {(["PETROL", "SPEED_PETROL", "DIESEL", "LUBRICANT"] as FuelType[]).map((ft) => (
                    <Card key={ft} className="bg-surface-2 border border-hairline p-4 flex flex-col justify-between">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">{ft}</p>
                      <div className="flex items-baseline gap-1 mt-2.5">
                        <span className="text-xl font-bold tracking-tight text-ink">
                          ₹{ft === "PETROL" ? "104.20" : ft === "SPEED_PETROL" ? "108.50" : ft === "DIESEL" ? "95.50" : "320.00"}
                        </span>
                        <span className="text-[10px] text-ink-subtle">/L</span>
                      </div>
                      <p className="text-[9px] text-success mt-1.5 flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" /> Active
                      </p>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Dialogs */}

      {/* 1. Add Dispenser Dialog */}
      <Dialog open={dispenserDialogOpen} onOpenChange={setDispenserDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Fuel size={18} className="text-fuel-amber" /> Create Fuel Dispenser
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDispenser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dispenserName" className="text-xs font-semibold text-ink-muted">
                Dispenser Name / Label
              </Label>
              <Input
                id="dispenserName"
                placeholder="e.g. Dispenser 1"
                value={dispenserName}
                onChange={(e) => setDispenserName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDispenserDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createDispenserMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {createDispenserMutation.isPending ? "Creating..." : "Create Dispenser"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Add Nozzle Dialog */}
      <Dialog open={nozzleDialogOpen} onOpenChange={setNozzleDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Calculator size={18} className="text-fuel-amber" /> Configure Nozzle
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNozzle} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nozzleName" className="text-xs font-semibold text-ink-muted">
                Nozzle Custom Name
              </Label>
              <Input
                id="nozzleName"
                placeholder="e.g. Nozzle 1A"
                value={nozzleName}
                onChange={(e) => setNozzleName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nozzleFuel" className="text-xs font-semibold text-ink-muted">
                Fuel Type
              </Label>
              <select
                id="nozzleFuel"
                value={nozzleFuelType}
                onChange={(e) => setNozzleFuelType(e.target.value as FuelType)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
              >
                <option value="PETROL">PETROL</option>
                <option value="SPEED_PETROL">SPEED PETROL</option>
                <option value="DIESEL">DIESEL</option>
                <option value="LUBRICANT">LUBRICANT</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nozzleInitial" className="text-xs font-semibold text-ink-muted">
                Initial Meter Reading (Liters)
              </Label>
              <Input
                id="nozzleInitial"
                type="number"
                step="0.01"
                placeholder="e.g. 1000.00"
                value={nozzleInitialReading}
                onChange={(e) => setNozzleInitialReading(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNozzleDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createNozzleMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {createNozzleMutation.isPending ? "Configuring..." : "Configure Nozzle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
