import { useState } from "react";
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
import type { FuelType, FuelTankCreate, DipReadingCreate, PriceScheduleCreate, NozzleCreate, NozzleReadingCreate } from "./types";

export default function InventoryPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tanks" | "nozzles" | "prices">("tanks");

  // Nozzle Dialog states
  const [nozzleDialogOpen, setNozzleDialogOpen] = useState(false);
  const [nozzleReadingDialogOpen, setNozzleReadingDialogOpen] = useState(false);
  const [selectedNozzleUuid, setSelectedNozzleUuid] = useState<string>("");

  // Create Nozzle Form states
  const [nozzleName, setNozzleName] = useState("");
  const [nozzlePipe1Fuel, setNozzlePipe1Fuel] = useState<FuelType>("PETROL");
  const [nozzlePipe1Initial, setNozzlePipe1Initial] = useState("");
  const [nozzlePipe2Fuel, setNozzlePipe2Fuel] = useState<FuelType>("SPEED_PETROL");
  const [nozzlePipe2Initial, setNozzlePipe2Initial] = useState("");

  // Log Nozzle Reading Form states
  const [nozzleReadingDate, setNozzleReadingDate] = useState(new Date().toISOString().split("T")[0]);
  const [nozzlePipe1Opening, setNozzlePipe1Opening] = useState<number | string>("");
  const [nozzlePipe1Closing, setNozzlePipe1Closing] = useState("");
  const [nozzlePipe2Opening, setNozzlePipe2Opening] = useState<number | string>("");
  const [nozzlePipe2Closing, setNozzlePipe2Closing] = useState("");

  // Dialog states
  const [tankDialogOpen, setTankDialogOpen] = useState(false);
  const [dipDialogOpen, setDipDialogOpen] = useState(false);
  const [selectedTankUuid, setSelectedTankUuid] = useState<string>("");

  // Create Tank Form states
  const [tankName, setTankName] = useState("");
  const [tankFuelType, setTankFuelType] = useState<FuelType>("PETROL");
  const [tankCapacity, setTankCapacity] = useState("");
  const [tankInitialStock, setTankInitialStock] = useState("");

  // Log Dip Form states
  const [openingDip, setOpeningDip] = useState("");
  const [closingDip, setClosingDip] = useState("");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split("T")[0]);

  // Create Price Schedule Form states
  const [priceFuelType, setPriceFuelType] = useState<FuelType>("PETROL");
  const [priceRate, setPriceRate] = useState("");
  const [priceEffectiveFrom, setPriceEffectiveFrom] = useState(
    new Date(Date.now() + 60000).toISOString().slice(0, 16) // Default to 1 minute in the future
  );

  // Queries
  const { data: tanks, isLoading: tanksLoading, isError: tanksError } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  const { data: dips } = useQuery({
    queryKey: ["dips"],
    queryFn: () => inventoryService.getDips(),
  });

  const { data: nozzles } = useQuery({
    queryKey: ["nozzles"],
    queryFn: () => inventoryService.getNozzles(),
  });

  const { data: nozzleReadings } = useQuery({
    queryKey: ["nozzleReadings"],
    queryFn: () => inventoryService.getNozzleReadings(),
  });

  // Mutations
  const createTankMutation = useMutation({
    mutationFn: (data: FuelTankCreate) => inventoryService.createTank(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      setTankDialogOpen(false);
      toast.success("Fuel tank created successfully!");
      // Reset form
      setTankName("");
      setTankCapacity("");
      setTankInitialStock("");
    },
    onError: (err) => {
      toast.error("Failed to create fuel tank.");
      console.error(err);
    },
  });

  const postDipMutation = useMutation({
    mutationFn: ({ tankUuid, data }: { tankUuid: string; data: DipReadingCreate }) =>
      inventoryService.postDipReading(tankUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["dips"] });
      setDipDialogOpen(false);
      toast.success("Dip reading and variance logged successfully!");
      // Reset form
      setOpeningDip("");
      setClosingDip("");
    },
    onError: (err) => {
      toast.error("Failed to register dip reading.");
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

  const createNozzleMutation = useMutation({
    mutationFn: (data: NozzleCreate) => inventoryService.createNozzle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nozzles"] });
      setNozzleDialogOpen(false);
      toast.success("Nozzle created successfully!");
      // Reset form
      setNozzleName("");
      setNozzlePipe1Initial("");
      setNozzlePipe2Initial("");
    },
    onError: (err) => {
      toast.error("Failed to create nozzle.");
      console.error(err);
    },
  });

  const postNozzleReadingMutation = useMutation({
    mutationFn: ({ nozzleUuid, data }: { nozzleUuid: string; data: NozzleReadingCreate }) =>
      inventoryService.postNozzleReading(nozzleUuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nozzles"] });
      queryClient.invalidateQueries({ queryKey: ["nozzleReadings"] });
      setNozzleReadingDialogOpen(false);
      toast.success("Nozzle readings logged successfully!");
      setNozzlePipe1Closing("");
      setNozzlePipe2Closing("");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to log nozzle readings.";
      toast.error(msg);
      console.error(err);
    },
  });

  const fetchOpeningReadings = async (nozzleUuid: string, dateStr: string) => {
    try {
      const openings = await inventoryService.getNozzleOpeningReadings(nozzleUuid, dateStr);
      setNozzlePipe1Opening(openings.pipe_1_opening);
      setNozzlePipe2Opening(openings.pipe_2_opening);
    } catch (err) {
      toast.error("Failed to load opening readings for selected date");
      console.error(err);
    }
  };

  // Form Submissions
  const handleCreateTank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tankName || !tankCapacity) {
      toast.error("Please fill in all required fields.");
      return;
    }
    createTankMutation.mutate({
      name: tankName,
      fuel_type: tankFuelType,
      capacity_liters: parseFloat(tankCapacity),
      current_stock_liters: parseFloat(tankInitialStock || "0"),
    });
  };

  const handlePostDip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingDip || !closingDip) {
      toast.error("Please specify both opening and closing dip levels.");
      return;
    }
    postDipMutation.mutate({
      tankUuid: selectedTankUuid,
      data: {
        opening_dip_liters: parseFloat(openingDip),
        closing_dip_liters: parseFloat(closingDip),
        reading_date: readingDate || undefined,
      },
    });
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

  const handleCreateNozzle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nozzleName || !nozzlePipe1Initial || !nozzlePipe2Initial) {
      toast.error("Please fill in all required fields.");
      return;
    }
    createNozzleMutation.mutate({
      name: nozzleName,
      pipe_1_fuel_type: nozzlePipe1Fuel,
      pipe_1_last_reading: parseFloat(nozzlePipe1Initial),
      pipe_2_fuel_type: nozzlePipe2Fuel,
      pipe_2_last_reading: parseFloat(nozzlePipe2Initial),
    });
  };

  const handlePostNozzleReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nozzlePipe1Closing || !nozzlePipe2Closing) {
      toast.error("Please fill in closing readings for both pipes.");
      return;
    }
    postNozzleReadingMutation.mutate({
      nozzleUuid: selectedNozzleUuid,
      data: {
        pipe_1_opening: nozzlePipe1Opening !== "" ? parseFloat(nozzlePipe1Opening.toString()) : undefined,
        pipe_2_opening: nozzlePipe2Opening !== "" ? parseFloat(nozzlePipe2Opening.toString()) : undefined,
        pipe_1_closing: parseFloat(nozzlePipe1Closing),
        pipe_2_closing: parseFloat(nozzlePipe2Closing),
        reading_date: nozzleReadingDate || undefined,
      },
    });
  };

  if (tanksLoading) {
    return <LoadingState />;
  }

  if (tanksError) {
    return <EmptyState message="Unable to load inventory data." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Inventory & Pricing"
          description="Monitor fuel tank capacities, log daily physical dip readings, and schedule automated price changes."
        />
        {isAdminOrManager && (
          <div className="flex gap-2">
            {activeTab === "tanks" && (
              <Button
                onClick={() => setTankDialogOpen(true)}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15"
              >
                <Plus size={16} className="mr-2" /> Add Fuel Tank
              </Button>
            )}
            {activeTab === "nozzles" && (
              <Button
                onClick={() => setNozzleDialogOpen(true)}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15"
              >
                <Plus size={16} className="mr-2" /> Add Nozzle
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-hairline gap-4">
        <button
          onClick={() => setActiveTab("tanks")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "tanks"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Tanks & Dips
        </button>
        <button
          onClick={() => setActiveTab("nozzles")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "nozzles"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Nozzles
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

      {activeTab === "tanks" ? (
        <div className="space-y-8 animate-fade-in">
          {/* Tanks Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tanks && tanks.length > 0 ? (
              tanks.map((tank) => {
                const fillPercent = Math.min(
                  100,
                  Math.max(0, (tank.current_stock_liters / tank.capacity_liters) * 100)
                );
                return (
                  <Card key={tank.uuid} className="glass overflow-hidden relative border-hairline">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="secondary"
                          className="bg-fuel-amber/10 text-fuel-amber text-[10px] uppercase font-mono font-bold"
                        >
                          {tank.fuel_type}
                        </Badge>
                        <Fuel size={18} className="text-ink-subtle" />
                      </div>
                      <CardTitle className="text-lg font-bold tracking-tight text-ink mt-2">
                        {tank.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-ink-subtle">
                        Capacity: {tank.capacity_liters.toLocaleString()} Liters
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="space-y-4">
                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-ink-muted">Stock Level</span>
                            <span className="text-ink font-semibold">
                              {tank.current_stock_liters.toLocaleString()} L ({fillPercent.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-surface-3 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-fuel-amber to-fuel-orange transition-all duration-500"
                              style={{ width: `${fillPercent}%` }}
                            />
                          </div>
                        </div>

                        {isAdminOrManager && (
                          <Button
                            onClick={() => {
                              setSelectedTankUuid(tank.uuid);
                              setDipDialogOpen(true);
                            }}
                            variant="outline"
                            className="w-full justify-center border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
                          >
                            <Calculator size={14} className="mr-2 text-fuel-amber" /> Log Dip Reading
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full">
                <Card className="border-dashed border-hairline bg-transparent p-6 text-center">
                  <Fuel className="mx-auto text-ink-subtle mb-3" size={32} />
                  <p className="text-sm font-medium text-ink">No fuel tanks configured.</p>
                  <p className="text-xs text-ink-subtle mt-1">
                    Click "Add Fuel Tank" to initialize physical stock tracking.
                  </p>
                </Card>
              </div>
            )}
          </div>

          {/* Dips Logs Table */}
          <Card className="glass border-hairline">
            <CardHeader className="pb-3 border-b border-hairline">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                  <Activity size={15} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight text-ink">
                    Physical Reconciliation Log
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-subtle">
                    Variance between physical dip calculations and virtual sales recorded via vouchers.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline hover:bg-transparent">
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Date
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Opening Dip
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Closing Dip
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Calc. Sales (Dips)
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Actual Sales (Vouchers)
                      </TableHead>
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                        Variance
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dips && dips.length > 0 ? (
                      dips.map((reading) => {
                        const hasVariance = Math.abs(reading.variance_liters) > 1.0;
                        return (
                          <TableRow key={reading.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                            <TableCell className="px-5 text-xs font-semibold text-ink">
                              {new Date(reading.reading_date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink-muted">
                              {reading.opening_dip_liters.toLocaleString()} L
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink-muted">
                              {reading.closing_dip_liters.toLocaleString()} L
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink">
                              {reading.sales_liters_calculated.toLocaleString()} L
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink">
                              {reading.actual_sales_from_vouchers.toLocaleString()} L
                            </TableCell>
                            <TableCell className="px-5 text-right">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  reading.variance_liters === 0
                                    ? "bg-success/10 text-success"
                                    : hasVariance
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-fuel-amber/10 text-fuel-amber"
                                }`}
                              >
                                {reading.variance_liters > 0 ? "+" : ""}
                                {reading.variance_liters.toFixed(2)} L
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="h-28 text-center text-xs text-ink-subtle">
                          No physical dip logs recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : activeTab === "nozzles" ? (
        <div className="space-y-8 animate-fade-in">
          {/* Nozzles Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {nozzles && nozzles.length > 0 ? (
              nozzles.map((nozzle) => (
                <Card key={nozzle.uuid} className="glass overflow-hidden relative border-hairline">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className="bg-fuel-amber/10 text-fuel-amber text-[10px] uppercase font-mono font-bold"
                      >
                        {nozzle.status}
                      </Badge>
                      <Fuel size={18} className="text-ink-subtle" />
                    </div>
                    <CardTitle className="text-lg font-bold tracking-tight text-ink mt-2">
                      {nozzle.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-4">
                      {/* Pipe 1 & Pipe 2 Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-surface-2 p-3 rounded-lg border border-hairline">
                          <p className="text-[10px] text-ink-subtle font-semibold uppercase">Pipe 1</p>
                          <Badge className="mt-1 text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15">
                            {nozzle.pipe_1_fuel_type}
                          </Badge>
                          <p className="text-xs font-bold text-ink mt-2">
                            {nozzle.pipe_1_last_reading.toLocaleString()} L
                          </p>
                        </div>
                        <div className="bg-surface-2 p-3 rounded-lg border border-hairline">
                          <p className="text-[10px] text-ink-subtle font-semibold uppercase">Pipe 2</p>
                          <Badge className="mt-1 text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15">
                            {nozzle.pipe_2_fuel_type}
                          </Badge>
                          <p className="text-xs font-bold text-ink mt-2">
                            {nozzle.pipe_2_last_reading.toLocaleString()} L
                          </p>
                        </div>
                      </div>

                      {isAdminOrManager && (
                        <Button
                          onClick={() => {
                            setSelectedNozzleUuid(nozzle.uuid);
                            setNozzleReadingDate(new Date().toISOString().split("T")[0]);
                            fetchOpeningReadings(nozzle.uuid, new Date().toISOString().split("T")[0]);
                            setNozzleReadingDialogOpen(true);
                          }}
                          variant="outline"
                          className="w-full justify-center border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
                        >
                          <Calculator size={14} className="mr-2 text-fuel-amber" /> Log Readings
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full">
                <Card className="border-dashed border-hairline bg-transparent p-6 text-center">
                  <Fuel className="mx-auto text-ink-subtle mb-3" size={32} />
                  <p className="text-sm font-medium text-ink">No nozzles configured.</p>
                  <p className="text-xs text-ink-subtle mt-1">
                    Click "Add Nozzle" to configure dispensing nozzles.
                  </p>
                </Card>
              </div>
            )}
          </div>

          {/* Nozzle Readings Logs Table */}
          <Card className="glass border-hairline">
            <CardHeader className="pb-3 border-b border-hairline">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                  <Activity size={15} />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight text-ink">
                    Nozzle Readings Reconciliation Log
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-subtle">
                    Track initial/final readings and daily sales calculated in liters for both pipes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline hover:bg-transparent">
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Date
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Nozzle
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Pipe 1 (Open / Close)
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Pipe 1 Sales
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Pipe 2 (Open / Close)
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Pipe 2 Sales
                      </TableHead>
                      <TableHead className="px-5 text-right text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Total Sales
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nozzleReadings && nozzleReadings.length > 0 ? (
                      nozzleReadings.map((reading) => {
                        const nz = nozzles?.find((n) => n.id === reading.nozzle_id);
                        return (
                          <TableRow key={reading.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                            <TableCell className="px-5 text-xs font-semibold text-ink">
                              {new Date(reading.reading_date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-ink font-semibold">
                              {nz ? nz.name : `Nozzle #${reading.nozzle_id}`}
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted">
                              {reading.pipe_1_opening.toFixed(2)} / {reading.pipe_1_closing.toFixed(2)} L
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-ink">
                              {reading.pipe_1_sales.toFixed(2)} L
                            </TableCell>
                            <TableCell className="text-xs text-ink-muted">
                              {reading.pipe_2_opening.toFixed(2)} / {reading.pipe_2_closing.toFixed(2)} L
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-ink">
                              {reading.pipe_2_sales.toFixed(2)} L
                            </TableCell>
                            <TableCell className="px-5 text-right">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono font-bold uppercase bg-fuel-amber/10 text-fuel-amber"
                              >
                                {reading.total_sales.toFixed(2)} L
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="h-28 text-center text-xs text-ink-subtle">
                          No nozzle logs recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
                  {(["PETROL", "DIESEL", "LUBRICANT"] as FuelType[]).map((ft) => (
                    <Card key={ft} className="bg-surface-2 border border-hairline p-4 flex flex-col justify-between">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">{ft}</p>
                      <div className="flex items-baseline gap-1 mt-2.5">
                        <span className="text-xl font-bold tracking-tight text-ink">
                          ₹{ft === "PETROL" ? "104.20" : ft === "DIESEL" ? "95.50" : "320.00"}
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

      {/* 1. Add Tank Dialog */}
      <Dialog open={tankDialogOpen} onOpenChange={setTankDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Fuel size={18} className="text-fuel-amber" /> Create Fuel Tank
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTank} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tankName" className="text-xs font-semibold text-ink-muted">
                Tank Name
              </Label>
              <Input
                id="tankName"
                placeholder="e.g. Tank A - Petrol"
                value={tankName}
                onChange={(e) => setTankName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tankFuelType" className="text-xs font-semibold text-ink-muted">
                Fuel Type
              </Label>
              <select
                id="tankFuelType"
                value={tankFuelType}
                onChange={(e) => setTankFuelType(e.target.value as FuelType)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
              >
                <option value="PETROL">PETROL</option>
                <option value="DIESEL">DIESEL</option>
                <option value="LUBRICANT">LUBRICANT</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tankCapacity" className="text-xs font-semibold text-ink-muted">
                Capacity (Liters)
              </Label>
              <Input
                id="tankCapacity"
                type="number"
                placeholder="e.g. 10000"
                value={tankCapacity}
                onChange={(e) => setTankCapacity(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tankInitialStock" className="text-xs font-semibold text-ink-muted">
                Initial Stock Level (Liters)
              </Label>
              <Input
                id="tankInitialStock"
                type="number"
                placeholder="e.g. 5000"
                value={tankInitialStock}
                onChange={(e) => setTankInitialStock(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTankDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                Create Tank
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Log Dip Reading Dialog */}
      <Dialog open={dipDialogOpen} onOpenChange={setDipDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Calculator size={18} className="text-fuel-amber" /> Log Physical Dip Reading
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePostDip} className="space-y-4 py-2">
            <div className="space-y-1.5 relative">
              <Label htmlFor="readingDate" className="text-xs font-semibold text-ink-muted">
                Reading Date
              </Label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer transition-colors"
                  size={14}
                  onClick={() => {
                    const el = document.getElementById("readingDate") as HTMLInputElement | null;
                    if (el && typeof el.showPicker === "function") {
                      el.showPicker();
                    }
                  }}
                />
                <Input
                  id="readingDate"
                  type="date"
                  value={readingDate}
                  onChange={(e) => setReadingDate(e.target.value)}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="openingDip" className="text-xs font-semibold text-ink-muted">
                Opening Physical Dip (Liters)
              </Label>
              <Input
                id="openingDip"
                type="number"
                step="0.1"
                placeholder="Initial dip reading level"
                value={openingDip}
                onChange={(e) => setOpeningDip(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="closingDip" className="text-xs font-semibold text-ink-muted">
                Closing Physical Dip (Liters)
              </Label>
              <Input
                id="closingDip"
                type="number"
                step="0.1"
                placeholder="Final dip reading level"
                value={closingDip}
                onChange={(e) => setClosingDip(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDipDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                Sync & Reconcile
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* 3. Add Nozzle Dialog */}
      <Dialog open={nozzleDialogOpen} onOpenChange={setNozzleDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Fuel size={18} className="text-fuel-amber" /> Configure Nozzle
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateNozzle} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nozzleName" className="text-xs font-semibold text-ink-muted">
                Nozzle Name
              </Label>
              <Input
                id="nozzleName"
                placeholder="e.g. Nozzle A"
                value={nozzleName}
                onChange={(e) => setNozzleName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="border border-hairline rounded-lg p-3 space-y-3 bg-surface-2/30">
              <h4 className="text-xs font-bold text-ink">Pipe 1 Configuration</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe1Fuel" className="text-[10px] font-semibold text-ink-subtle">
                    Fuel Type
                  </Label>
                  <select
                    id="nozzlePipe1Fuel"
                    value={nozzlePipe1Fuel}
                    onChange={(e) => setNozzlePipe1Fuel(e.target.value as FuelType)}
                    className="w-full rounded-md border border-hairline bg-surface-2 p-1.5 text-xs text-ink outline-none"
                  >
                    <option value="PETROL">PETROL</option>
                    <option value="SPEED_PETROL">SPEED PETROL</option>
                    <option value="DIESEL">DIESEL</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe1Initial" className="text-[10px] font-semibold text-ink-subtle">
                    Initial Reading (L)
                  </Label>
                  <Input
                    id="nozzlePipe1Initial"
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    value={nozzlePipe1Initial}
                    onChange={(e) => setNozzlePipe1Initial(e.target.value)}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border border-hairline rounded-lg p-3 space-y-3 bg-surface-2/30">
              <h4 className="text-xs font-bold text-ink">Pipe 2 Configuration</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe2Fuel" className="text-[10px] font-semibold text-ink-subtle">
                    Fuel Type
                  </Label>
                  <select
                    id="nozzlePipe2Fuel"
                    value={nozzlePipe2Fuel}
                    onChange={(e) => setNozzlePipe2Fuel(e.target.value as FuelType)}
                    className="w-full rounded-md border border-hairline bg-surface-2 p-1.5 text-xs text-ink outline-none"
                  >
                    <option value="PETROL">PETROL</option>
                    <option value="SPEED_PETROL">SPEED PETROL</option>
                    <option value="DIESEL">DIESEL</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe2Initial" className="text-[10px] font-semibold text-ink-subtle">
                    Initial Reading (L)
                  </Label>
                  <Input
                    id="nozzlePipe2Initial"
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    value={nozzlePipe2Initial}
                    onChange={(e) => setNozzlePipe2Initial(e.target.value)}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink"
                    required
                  />
                </div>
              </div>
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
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                Create Nozzle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 4. Log Nozzle Readings Dialog */}
      <Dialog open={nozzleReadingDialogOpen} onOpenChange={setNozzleReadingDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Calculator size={18} className="text-fuel-amber" /> Log Nozzle Readings
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePostNozzleReading} className="space-y-4 py-2">
            <div className="space-y-1.5 relative">
              <Label htmlFor="nozzleReadingDate" className="text-xs font-semibold text-ink-muted">
                Reading Date
              </Label>
              <div className="relative">
                <Calendar
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer transition-colors"
                  size={14}
                  onClick={() => {
                    const el = document.getElementById("nozzleReadingDate") as HTMLInputElement | null;
                    if (el && typeof el.showPicker === "function") {
                      el.showPicker();
                    }
                  }}
                />
                <Input
                  id="nozzleReadingDate"
                  type="date"
                  value={nozzleReadingDate}
                  onChange={(e) => {
                    setNozzleReadingDate(e.target.value);
                    fetchOpeningReadings(selectedNozzleUuid, e.target.value);
                  }}
                  className="bg-surface-2 border-hairline outline-none text-sm text-ink pl-10"
                  required
                />
              </div>
            </div>

            <div className="border border-hairline rounded-lg p-3 space-y-3 bg-surface-2/30">
              <h4 className="text-xs font-bold text-ink">Pipe 1 Readings</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe1Opening" className="text-[10px] font-semibold text-ink-subtle">
                    Opening Reading (L)
                  </Label>
                  <Input
                    id="nozzlePipe1Opening"
                    type="number"
                    step="0.01"
                    placeholder="Enter opening reading"
                    value={nozzlePipe1Opening}
                    onChange={(e) => setNozzlePipe1Opening(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe1Closing" className="text-[10px] font-semibold text-ink-subtle">
                    Closing Reading (L)
                  </Label>
                  <Input
                    id="nozzlePipe1Closing"
                    type="number"
                    step="0.01"
                    placeholder="Enter final reading"
                    value={nozzlePipe1Closing}
                    onChange={(e) => setNozzlePipe1Closing(e.target.value)}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border border-hairline rounded-lg p-3 space-y-3 bg-surface-2/30">
              <h4 className="text-xs font-bold text-ink">Pipe 2 Readings</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe2Opening" className="text-[10px] font-semibold text-ink-subtle">
                    Opening Reading (L)
                  </Label>
                  <Input
                    id="nozzlePipe2Opening"
                    type="number"
                    step="0.01"
                    placeholder="Enter opening reading"
                    value={nozzlePipe2Opening}
                    onChange={(e) => setNozzlePipe2Opening(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nozzlePipe2Closing" className="text-[10px] font-semibold text-ink-subtle">
                    Closing Reading (L)
                  </Label>
                  <Input
                    id="nozzlePipe2Closing"
                    type="number"
                    step="0.01"
                    placeholder="Enter final reading"
                    value={nozzlePipe2Closing}
                    onChange={(e) => setNozzlePipe2Closing(e.target.value)}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNozzleReadingDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                Save Readings
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
