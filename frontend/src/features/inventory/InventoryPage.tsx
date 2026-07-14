import { useState, useEffect, useMemo } from "react";
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
  Edit2,
  Trash2,
  History,
  Coins,
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
import paymentService from "@/features/payments/services/paymentService";
import type { FuelType, PriceScheduleCreate, FuelDispenserCreate, NozzleCreate, BulkNozzleReadingCreate } from "./types";

export default function InventoryPage() {
  const { hasRole } = useCurrentUser();
  const isAdminOrManager = hasRole("ADMIN", "MANAGER");

  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"dispensers" | "readings" | "history" | "prices" | "sales">("dispensers");

  // Dispensers and Nozzles state
  const [dispenserDialogOpen, setDispenserDialogOpen] = useState(false);
  const [editDispenserDialogOpen, setEditDispenserDialogOpen] = useState(false);
  const [deleteDispenserDialogOpen, setDeleteDispenserDialogOpen] = useState(false);
  
  const [nozzleDialogOpen, setNozzleDialogOpen] = useState(false);
  const [editNozzleDialogOpen, setEditNozzleDialogOpen] = useState(false);
  const [deleteNozzleDialogOpen, setDeleteNozzleDialogOpen] = useState(false);
  
  const [selectedDispenserUuid, setSelectedDispenserUuid] = useState("");
  const [selectedNozzleUuid, setSelectedNozzleUuid] = useState("");

  const [dispenserName, setDispenserName] = useState("");
  const [editDispenserName, setEditDispenserName] = useState("");
  const [editDispenserStatus, setEditDispenserStatus] = useState("ACTIVE");

  const [nozzleName, setNozzleName] = useState("");
  const [nozzleFuelType, setNozzleFuelType] = useState<FuelType>("PETROL");
  const [nozzleInitialReading, setNozzleInitialReading] = useState("");

  const [editNozzleName, setEditNozzleName] = useState("");
  const [editNozzleFuelType, setEditNozzleFuelType] = useState<FuelType>("PETROL");
  const [editNozzleInitialReading, setEditNozzleInitialReading] = useState("");

  // Meter Readings Bulk Entry state
  const [readingsDate, setReadingsDate] = useState(new Date().toISOString().split("T")[0]);
  const [formItems, setFormItems] = useState<Record<string, { opening: string | number; closing: string | number }>>({});
  
  // Safe editing states for saved readings
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);

  // Sales Accounting states
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split("T")[0]);

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

  const { data: nozzleReadings, isLoading: readingsLoading } = useQuery({
    queryKey: ["nozzleReadingsHistory"],
    queryFn: () => inventoryService.getNozzleReadings(),
    enabled: activeTab === "history",
  });

  // Lookup map to translate nozzle ID into nozzle & dispenser details
  const nozzleLookup = useMemo(() => {
    const map: Record<number, { nozzleName: string; dispenserName: string; fuel_type: FuelType }> = {};
    dispensers?.forEach((d) => {
      d.nozzles?.forEach((n) => {
        map[n.id] = { nozzleName: n.name, dispenserName: d.name, fuel_type: n.fuel_type };
      });
    });
    return map;
  }, [dispensers]);

  // Group readings date-wise for chronological display in history logs
  const groupedReadings = useMemo(() => {
    if (!nozzleReadings) return [];
    const groups: Record<string, typeof nozzleReadings> = {};
    nozzleReadings.forEach((reading) => {
      const dateStr = reading.reading_date;
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(reading);
    });
    return Object.entries(groups)
      .map(([dateStr, items]) => {
        const totalSales = items.reduce((sum, item) => sum + item.sales, 0);
        return {
          date: dateStr,
          items,
          totalSales,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [nozzleReadings]);

  // Sales Tab Queries & Grouping
  const { data: salesForm, isLoading: salesFormLoading } = useQuery({
    queryKey: ["salesReadings", salesDate],
    queryFn: () => inventoryService.getBulkReadingsForm(salesDate),
    enabled: activeTab === "sales",
  });

  const { data: dailyPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["dailyPayments", salesDate],
    queryFn: () => paymentService.getPayments({ payment_date: salesDate, page_size: 100 }),
    enabled: activeTab === "sales",
  });

  const salesDispenserGroups = useMemo(() => {
    if (!salesForm?.items) return {};
    const groups: Record<string, typeof salesForm.items> = {};
    salesForm.items.forEach((item) => {
      const dName = item.dispenser_name;
      if (!groups[dName]) {
        groups[dName] = [];
      }
      groups[dName].push(item);
    });
    return groups;
  }, [salesForm]);

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

  // Reset unlock status when switching logging dates
  useEffect(() => {
    setIsEditingSaved(false);
  }, [readingsDate]);

  // Evaluate if there are any saved logs on this date
  const hasSavedReadings = useMemo(() => {
    return bulkForm?.items.some((item) => item.closing_reading !== null) ?? false;
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

  const updateDispenserMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: FuelDispenserCreate }) =>
      inventoryService.updateDispenser(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      setEditDispenserDialogOpen(false);
      toast.success("Fuel dispenser updated successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to update fuel dispenser.";
      toast.error(msg);
      console.error(err);
    },
  });

  const deleteDispenserMutation = useMutation({
    mutationFn: (uuid: string) => inventoryService.deleteDispenser(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      queryClient.invalidateQueries({ queryKey: ["nozzleReadingsHistory"] });
      queryClient.invalidateQueries({ queryKey: ["bulkReadings"] });
      setDeleteDispenserDialogOpen(false);
      toast.success("Fuel dispenser deleted successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to delete fuel dispenser.";
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

  const updateNozzleMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: NozzleCreate }) =>
      inventoryService.updateNozzle(uuid, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      setEditNozzleDialogOpen(false);
      toast.success("Nozzle updated successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to update nozzle.";
      toast.error(msg);
      console.error(err);
    },
  });

  const deleteNozzleMutation = useMutation({
    mutationFn: (uuid: string) => inventoryService.deleteNozzle(uuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      queryClient.invalidateQueries({ queryKey: ["bulkReadings"] });
      queryClient.invalidateQueries({ queryKey: ["nozzleReadingsHistory"] });
      setDeleteNozzleDialogOpen(false);
      toast.success("Nozzle deleted successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to delete nozzle.";
      toast.error(msg);
      console.error(err);
    },
  });

  const postBulkReadingsMutation = useMutation({
    mutationFn: (data: BulkNozzleReadingCreate) => inventoryService.postBulkReadings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      queryClient.invalidateQueries({ queryKey: ["bulkReadings"] });
      queryClient.invalidateQueries({ queryKey: ["nozzleReadingsHistory"] });
      setIsEditingSaved(false); // Re-lock inputs on successful write
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

  const handleUpdateDispenser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDispenserName.trim()) {
      toast.error("Please fill in dispenser name.");
      return;
    }
    updateDispenserMutation.mutate({
      uuid: selectedDispenserUuid,
      data: {
        name: editDispenserName,
        status: editDispenserStatus,
      },
    });
  };

  const handleDeleteDispenser = (e: React.FormEvent) => {
    e.preventDefault();
    deleteDispenserMutation.mutate(selectedDispenserUuid);
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

  const handleUpdateNozzle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNozzleName.trim() || !editNozzleInitialReading) {
      toast.error("Please specify a custom name and valid initial meter reading.");
      return;
    }
    updateNozzleMutation.mutate({
      uuid: selectedNozzleUuid,
      data: {
        name: editNozzleName,
        fuel_type: editNozzleFuelType,
        last_reading: parseFloat(editNozzleInitialReading),
      },
    });
  };

  const handleDeleteNozzle = (e: React.FormEvent) => {
    e.preventDefault();
    deleteNozzleMutation.mutate(selectedNozzleUuid);
  };

  const handleSaveBulkReadings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Filter out empty closing values so users can selectively save entered nozzle readings
      const readings = Object.entries(formItems)
        .filter(([_, vals]) => vals.closing.toString().trim() !== "")
        .map(([uuid, vals]) => {
          const closing = parseFloat(vals.closing.toString().trim());
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

      if (readings.length === 0) {
        toast.error("Please enter a closing reading for at least one nozzle.");
        return;
      }

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
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "history"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Meter Logs
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all px-2 cursor-pointer ${
            activeTab === "sales"
              ? "border-fuel-amber text-ink font-bold"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          Sales Section
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
                      <div className="flex items-center gap-1.5">
                        {isAdminOrManager && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedDispenserUuid(dispenser.uuid);
                                setEditDispenserName(dispenser.name);
                                setEditDispenserStatus(dispenser.status);
                                setEditDispenserDialogOpen(true);
                              }}
                              className="text-ink-subtle hover:text-fuel-amber transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer"
                              title="Edit Dispenser"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDispenserUuid(dispenser.uuid);
                                setDeleteDispenserDialogOpen(true);
                              }}
                              className="text-ink-subtle hover:text-destructive transition-colors p-1 rounded hover:bg-surface-3 cursor-pointer"
                              title="Delete Dispenser"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        <Fuel size={18} className="text-ink-subtle" />
                      </div>
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
                              <div className="flex-grow">
                                <p className="text-xs font-bold text-ink">{nozzle.name}</p>
                                <p className="text-[10px] text-ink-subtle mt-0.5">
                                  Last Meter: {nozzle.last_reading.toLocaleString()} L
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber border-transparent hover:bg-fuel-amber/15 mr-1">
                                  {nozzle.fuel_type}
                                </Badge>
                                {isAdminOrManager && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedNozzleUuid(nozzle.uuid);
                                        setEditNozzleName(nozzle.name);
                                        setEditNozzleFuelType(nozzle.fuel_type);
                                        setEditNozzleInitialReading(nozzle.last_reading.toString());
                                        setEditNozzleDialogOpen(true);
                                      }}
                                      className="text-ink-subtle hover:text-fuel-amber transition-colors p-0.5 rounded hover:bg-surface-3 cursor-pointer"
                                      title="Edit Nozzle"
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedNozzleUuid(nozzle.uuid);
                                        setDeleteNozzleDialogOpen(true);
                                      }}
                                      className="text-ink-subtle hover:text-destructive transition-colors p-0.5 rounded hover:bg-surface-3 cursor-pointer"
                                      title="Delete Nozzle"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                              </div>
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
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const d = new Date(readingsDate);
                    d.setDate(d.getDate() - 1);
                    setReadingsDate(d.toISOString().split("T")[0]);
                  }}
                  className="h-8 w-8 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer"
                  title="Previous Day"
                >
                  &larr;
                </Button>
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
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink pl-9 pr-2 py-1 h-8 w-32"
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const d = new Date(readingsDate);
                    d.setDate(d.getDate() + 1);
                    setReadingsDate(d.toISOString().split("T")[0]);
                  }}
                  className="h-8 w-8 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer"
                  title="Next Day"
                >
                  &rarr;
                </Button>
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
                            Initial Reading (L) (Editable)
                          </TableHead>
                          <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-44">
                            Final Reading (L) (Editable)
                          </TableHead>
                          <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right w-36">
                            Sales (Liters)
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkForm.items.map((item, idx) => {
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
                                  disabled={hasSavedReadings && !isEditingSaved}
                                  className="w-32 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed"
                                />
                              </TableCell>
                              <TableCell className="py-2.5">
                                <Input
                                  id={`closing-input-${idx}`}
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
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const nextInput = document.getElementById(`closing-input-${idx + 1}`) as HTMLInputElement | null;
                                      if (nextInput) {
                                        nextInput.focus();
                                        nextInput.select();
                                      }
                                    }
                                  }}
                                  disabled={hasSavedReadings && !isEditingSaved}
                                  className="w-36 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
                {hasSavedReadings && !isEditingSaved ? (
                  <p className="text-xs text-fuel-amber flex items-center gap-1.5 font-semibold bg-fuel-amber/5 border border-fuel-amber/10 px-3 py-1.5 rounded-lg">
                    <AlertTriangle size={14} /> Readings for this date are saved and locked.
                  </p>
                ) : (
                  <p className="text-xs text-ink-subtle italic">
                    {hasSavedReadings ? "Editing saved meter readings..." : "No readings recorded for this date."}
                  </p>
                )}

                <div className="flex justify-end">
                  {hasSavedReadings && !isEditingSaved ? (
                    <Button
                      type="button"
                      onClick={() => setUnlockConfirmOpen(true)}
                      className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-6 py-2 shadow-md cursor-pointer text-xs"
                    >
                      Edit Saved Readings
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={postBulkReadingsMutation.isPending}
                      className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-6 py-2 shadow-md cursor-pointer text-xs"
                    >
                      {postBulkReadingsMutation.isPending ? "Saving changes..." : hasSavedReadings ? "Save Changes" : "Save All Readings"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
      ) : activeTab === "history" ? (
        <div className="space-y-6 animate-fade-in">
          {/* Header Toolbar */}
          <Card className="glass border-hairline p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                <History size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Meter Readings History</h3>
                <p className="text-xs text-ink-subtle">
                  Chronological logs of all configured daily dispenser meter readings.
                </p>
              </div>
            </div>
          </Card>

          {readingsLoading ? (
            <Card className="glass border-hairline p-12 text-center text-xs text-ink-subtle">
              Loading meter readings history...
            </Card>
          ) : groupedReadings && groupedReadings.length > 0 ? (
            <div className="space-y-6">
              {groupedReadings.map((group) => {
                const formattedDate = new Date(group.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
                return (
                  <Card key={group.date} className="glass border-hairline overflow-hidden">
                    <div className="bg-surface-3/50 px-5 py-3.5 border-b border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="text-xs font-bold text-ink">
                        {formattedDate}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-ink-muted">
                          Daily Volume:
                        </span>
                        <Badge className="bg-fuel-amber/20 hover:bg-fuel-amber/20 text-fuel-amber font-mono font-bold text-xs border-transparent px-2.5 py-0.5">
                          {group.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-hairline hover:bg-transparent">
                              <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                                Dispenser
                              </TableHead>
                              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                                Nozzle Name
                              </TableHead>
                              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                                Fuel Type
                              </TableHead>
                              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                                Initial Reading (L)
                              </TableHead>
                              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                                Final Reading (L)
                              </TableHead>
                              <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                                Sales (L)
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((reading) => {
                              const lookup = nozzleLookup[reading.nozzle_id] || {
                                nozzleName: `Nozzle #${reading.nozzle_id}`,
                                dispenserName: "Deleted Dispenser",
                                fuel_type: "UNKNOWN",
                              };
                              return (
                                <TableRow key={reading.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                                  <TableCell className="px-5 text-xs font-bold text-ink">
                                    {lookup.dispenserName}
                                  </TableCell>
                                  <TableCell className="text-xs font-semibold text-ink-muted">
                                    {lookup.nozzleName}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium text-ink-muted">
                                    <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent">
                                      {lookup.fuel_type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-ink-muted font-medium">
                                    {reading.opening_reading.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                                  </TableCell>
                                  <TableCell className="text-xs text-ink-muted font-medium">
                                    {reading.closing_reading.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                                  </TableCell>
                                  <TableCell className="px-5 text-right font-bold text-xs text-ink">
                                    {reading.sales.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="glass border-hairline p-12 text-center text-xs text-ink-subtle italic">
              No meter logs recorded yet.
            </Card>
          )}
        </div>
      ) : activeTab === "sales" ? (
        <div className="space-y-6 animate-fade-in">
          {/* Sales Accounting Toolbar */}
          <Card className="glass border-hairline p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
                <Coins size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Daily Sales Accounting Sheet</h3>
                <p className="text-xs text-ink-subtle">
                  Daily worksheet detailing nozzle meter readings and payment collection totals.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="salesDateInput" className="text-xs font-semibold text-ink-muted shrink-0">
                Accounting Date:
              </Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const d = new Date(salesDate);
                    d.setDate(d.getDate() - 1);
                    setSalesDate(d.toISOString().split("T")[0]);
                  }}
                  className="h-8 w-8 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer"
                  title="Previous Day"
                >
                  &larr;
                </Button>
                <div className="relative">
                  <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer transition-colors"
                    size={14}
                    onClick={() => {
                      const el = document.getElementById("salesDateInput") as HTMLInputElement | null;
                      if (el && typeof el.showPicker === "function") {
                        el.showPicker();
                      }
                    }}
                  />
                  <Input
                    id="salesDateInput"
                    type="date"
                    value={salesDate}
                    onChange={(e) => setSalesDate(e.target.value)}
                    className="bg-surface-2 border-hairline outline-none text-xs text-ink pl-9 pr-2 py-1 h-8 w-32"
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const d = new Date(salesDate);
                    d.setDate(d.getDate() + 1);
                    setSalesDate(d.toISOString().split("T")[0]);
                  }}
                  className="h-8 w-8 p-0 border border-hairline hover:bg-surface-3 text-ink cursor-pointer"
                  title="Next Day"
                >
                  &rarr;
                </Button>
              </div>
            </div>
          </Card>

          {salesFormLoading || paymentsLoading ? (
            <Card className="glass border-hairline p-12 text-center text-xs text-ink-subtle">
              Loading daily accounting sheet...
            </Card>
          ) : (
            <>
              {/* Daily Nozzle Worksheet Cards (Grouped by Dispenser) */}
              <div className="space-y-6">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-muted px-1 font-bold">
                  Daily Nozzle Reading Worksheet
                </h3>

                {Object.keys(salesDispenserGroups).length > 0 ? (
                  Object.entries(salesDispenserGroups).map(([dispenserName, items]) => (
                    <Card key={dispenserName} className="glass border-hairline overflow-hidden">
                      <div className="bg-surface-3/50 px-5 py-3 border-b border-hairline">
                        <span className="text-xs font-bold text-ink">{dispenserName}</span>
                      </div>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {items.map((item) => {
                            const opening = item.opening_reading || 0;
                            const closing = item.closing_reading !== null ? item.closing_reading : null;
                            const sales = closing !== null && closing >= opening ? closing - opening : null;

                            return (
                              <div
                                key={item.nozzle_uuid}
                                className="border border-hairline rounded-lg overflow-hidden bg-surface-2 flex flex-col text-center divide-y divide-hairline shadow-sm"
                              >
                                {/* Nozzle Name & Fuel Type Header */}
                                <div className="bg-surface-3/30 px-2 py-1.5 font-bold text-xs text-ink flex items-center justify-center gap-1.5">
                                  <span className="truncate">{item.nozzle_name}</span>
                                  <Badge className="text-[8px] px-1 py-0 uppercase bg-fuel-amber/10 text-fuel-amber hover:bg-fuel-amber/10 border-transparent font-bold">
                                    {item.fuel_type}
                                  </Badge>
                                </div>

                                {/* Closing Reading */}
                                <div className="py-2.5 px-3">
                                  <div className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">
                                    Closing Reading
                                  </div>
                                  <div className="text-sm font-extrabold text-ink mt-0.5 font-mono">
                                    {closing !== null ? closing.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}
                                  </div>
                                </div>

                                {/* Opening Reading */}
                                <div className="py-2.5 px-3">
                                  <div className="text-[10px] uppercase font-mono tracking-wider text-ink-subtle">
                                    Opening Reading
                                  </div>
                                  <div className="text-sm font-extrabold text-ink-muted mt-0.5 font-mono">
                                    {opening.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </div>
                                </div>

                                {/* Liters Sold */}
                                <div className="py-2.5 px-3 bg-fuel-amber/5">
                                  <div className="text-[10px] uppercase font-mono tracking-wider text-fuel-amber/80 font-bold">
                                    Liters Sold
                                  </div>
                                  <div className="text-base font-black text-fuel-amber mt-0.5 font-mono">
                                    {sales !== null ? `${sales.toLocaleString(undefined, { minimumFractionDigits: 2 })} L` : "—"}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="glass border-hairline p-8 text-center text-xs text-ink-subtle italic">
                    No active dispenser machines or nozzle readings saved for this date.
                  </Card>
                )}
              </div>

              {/* Payments Collection summary */}
              <Card className="glass border-hairline overflow-hidden mt-8">
                <CardHeader className="pb-3 border-b border-hairline bg-surface-3/50 px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-ink uppercase tracking-wider font-mono">
                      Payments Collection Summary
                    </CardTitle>
                    <Badge className="bg-fuel-amber/15 text-fuel-amber border-transparent font-mono font-bold text-[10px] uppercase">
                      {dailyPayments?.items?.length || 0} Transactions
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {dailyPayments && dailyPayments.items.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-hairline hover:bg-transparent">
                            <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                              Customer
                            </TableHead>
                            <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                              Payment Mode
                            </TableHead>
                            <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                              Reference Number
                            </TableHead>
                            <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">
                              Remarks
                            </TableHead>
                            <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">
                              Amount (₹)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dailyPayments.items.map((payment) => (
                            <TableRow key={payment.uuid} className="border-b border-hairline hover:bg-surface-3/15">
                              <TableCell className="px-5 text-xs font-bold text-ink">
                                {payment.customer_name}
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-ink-muted">
                                <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent">
                                  {payment.payment_mode}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-ink-subtle font-mono">
                                {payment.reference_number || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-ink-muted italic">
                                {payment.remarks || "—"}
                              </TableCell>
                              <TableCell className="px-5 text-right font-bold text-xs text-ink font-mono">
                                ₹{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals Summary Row */}
                          <TableRow className="bg-surface-3/20 font-bold hover:bg-surface-3/20 border-t border-hairline">
                            <TableCell colSpan={4} className="px-5 text-xs font-bold text-ink text-right uppercase tracking-wider">
                              Total Payments Collected:
                            </TableCell>
                            <TableCell className="px-5 text-right text-sm font-black text-fuel-amber font-mono">
                              ₹{dailyPayments.items.reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-ink-subtle italic">
                      No customer payment receipts logged on this date.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
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
                  {(["PETROL", "SPEED", "DIESEL", "LUBRICANT"] as FuelType[]).map((ft) => (
                    <Card key={ft} className="bg-surface-2 border border-hairline p-4 flex flex-col justify-between">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">{ft}</p>
                      <div className="flex items-baseline gap-1 mt-2.5">
                        <span className="text-xl font-bold tracking-tight text-ink">
                          ₹{ft === "PETROL" ? "104.20" : ft === "SPEED" ? "108.50" : ft === "DIESEL" ? "95.50" : "320.00"}
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

      {/* 1b. Edit Dispenser Dialog */}
      <Dialog open={editDispenserDialogOpen} onOpenChange={setEditDispenserDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Edit2 size={18} className="text-fuel-amber" /> Edit Fuel Dispenser
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateDispenser} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editDispenserName" className="text-xs font-semibold text-ink-muted">
                Dispenser Name / Label
              </Label>
              <Input
                id="editDispenserName"
                placeholder="e.g. Dispenser A"
                value={editDispenserName}
                onChange={(e) => setEditDispenserName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editDispenserStatus" className="text-xs font-semibold text-ink-muted">
                Dispenser Status
              </Label>
              <select
                id="editDispenserStatus"
                value={editDispenserStatus}
                onChange={(e) => setEditDispenserStatus(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="OUT_OF_ORDER">OUT OF ORDER</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDispenserDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateDispenserMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {updateDispenserMutation.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 1c. Delete Dispenser Confirmation Dialog */}
      <Dialog open={deleteDispenserDialogOpen} onOpenChange={setDeleteDispenserDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> Delete Fuel Dispenser
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDeleteDispenser} className="space-y-4 py-2">
            <p className="text-xs text-ink-muted">
              Are you sure you want to delete this dispenser machine? This will also delete all of its configured nozzles and reading history logs. This action cannot be undone.
            </p>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDispenserDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={deleteDispenserMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {deleteDispenserMutation.isPending ? "Deleting..." : "Delete Dispenser"}
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
                <option value="SPEED">SPEED</option>
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

      {/* 2b. Edit Nozzle Dialog */}
      <Dialog open={editNozzleDialogOpen} onOpenChange={setEditNozzleDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Edit2 size={18} className="text-fuel-amber" /> Edit Nozzle Configuration
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateNozzle} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="editNozzleName" className="text-xs font-semibold text-ink-muted">
                Nozzle Name
              </Label>
              <Input
                id="editNozzleName"
                placeholder="e.g. Nozzle 1A"
                value={editNozzleName}
                onChange={(e) => setEditNozzleName(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editNozzleFuel" className="text-xs font-semibold text-ink-muted">
                Fuel Type
              </Label>
              <select
                id="editNozzleFuel"
                value={editNozzleFuelType}
                onChange={(e) => setEditNozzleFuelType(e.target.value as FuelType)}
                className="w-full rounded-md border border-hairline bg-surface-2 p-2 text-sm text-ink outline-none"
              >
                <option value="PETROL">PETROL</option>
                <option value="SPEED">SPEED</option>
                <option value="DIESEL">DIESEL</option>
                <option value="LUBRICANT">LUBRICANT</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editNozzleInitial" className="text-xs font-semibold text-ink-muted">
                Initial Meter Reading (Liters)
              </Label>
              <Input
                id="editNozzleInitial"
                type="number"
                step="0.01"
                placeholder="e.g. 1000.00"
                value={editNozzleInitialReading}
                onChange={(e) => setEditNozzleInitialReading(e.target.value)}
                className="bg-surface-2 border-hairline outline-none text-sm text-ink"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditNozzleDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateNozzleMutation.isPending}
                className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {updateNozzleMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2c. Delete Nozzle Confirmation Dialog */}
      <Dialog open={deleteNozzleDialogOpen} onOpenChange={setDeleteNozzleDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> Delete Nozzle
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDeleteNozzle} className="space-y-4 py-2">
            <p className="text-xs text-ink-muted">
              Are you sure you want to delete this nozzle? This will permanently delete its meter readings configuration and logs. This action cannot be undone.
            </p>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteNozzleDialogOpen(false)}
                className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={deleteNozzleMutation.isPending}
                className="bg-destructive hover:bg-destructive/90 text-canvas font-semibold text-xs cursor-pointer"
              >
                {deleteNozzleMutation.isPending ? "Deleting..." : "Delete Nozzle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 3. Unlock Confirmation Dialog */}
      <Dialog open={unlockConfirmOpen} onOpenChange={setUnlockConfirmOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2 text-fuel-amber">
              <AlertTriangle size={18} /> Edit Saved Readings?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-ink-muted">
              Are you sure you want to unlock and edit the saved meter readings for{" "}
              <strong className="text-ink font-bold">
                {new Date(readingsDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </strong>
              ? Modifying finalized entries may affect subsequent date rollovers.
            </p>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnlockConfirmOpen(false)}
              className="border-hairline hover:bg-surface-3 text-ink-subtle hover:text-ink text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsEditingSaved(true);
                setUnlockConfirmOpen(false);
              }}
              className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
            >
              Confirm & Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
