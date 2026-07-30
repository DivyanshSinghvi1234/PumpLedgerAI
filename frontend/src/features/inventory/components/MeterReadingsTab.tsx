import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Calendar, AlertTriangle, Sunrise, ChevronDown, ChevronRight, Clock, Fuel, Wrench } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "../services/inventoryService";
import settingService from "@/features/settings/services/settingService";
import type { BulkNozzleReadingCreate } from "../types";

export default function MeterReadingsTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  // Local state
  const [readingsDate, setReadingsDate] = useState(new Date().toISOString().split("T")[0]);
  const [formItems, setFormItems] = useState<
    Record<
      string,
      {
        opening: string | number;
        closing: string | number;
        interim6am: string | number;
        testing: string | number;
        sales: string;
      }
    >
  >({});
  const [globalReturnTestingToStorage, setGlobalReturnTestingToStorage] = useState(true);
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);
  const [maintenanceMap, setMaintenanceMap] = useState<Record<string, boolean>>({});

  // Shared times for all nozzles (operator takes readings together)
  const [sharedOpeningTime, setSharedOpeningTime] = useState(
    () => localStorage.getItem("meter_reading_opening_time") || "19:30"
  );
  const [sharedClosingTime, setSharedClosingTime] = useState(
    () => localStorage.getItem("meter_reading_closing_time") || "19:30"
  );

  // Which nozzles have the 6 AM interim reading row expanded
  const [expanded6am, setExpanded6am] = useState<Record<string, boolean>>({});

  // Persistent nozzle custom display order saved in localStorage
  const [customNozzleOrder, setCustomNozzleOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("meter_nozzle_custom_order");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Query: bulk form readings for the selected date
  const {
    data: bulkForm,
    isLoading: bulkFormLoading,
    isError: bulkFormError,
    error: bulkFormErrorObj,
    refetch: refetchBulkForm,
  } = useQuery({
    queryKey: ["bulkReadings", readingsDate],
    queryFn: () => inventoryService.getBulkReadingsForm(readingsDate),
  });

  // Sort bulk form items according to customNozzleOrder, placing any newly added nozzles at the end
  const sortedBulkItems = useMemo(() => {
    if (!bulkForm?.items) return [];

    const itemsCopy = [...bulkForm.items];
    const orderMap = new Map(customNozzleOrder.map((uuid, idx) => [uuid, idx]));

    return itemsCopy.sort((a, b) => {
      const idxA = orderMap.has(a.nozzle_uuid) ? (orderMap.get(a.nozzle_uuid) as number) : 999999;
      const idxB = orderMap.has(b.nozzle_uuid) ? (orderMap.get(b.nozzle_uuid) as number) : 999999;

      if (idxA !== idxB) {
        return idxA - idxB;
      }
      return a.dispenser_name.localeCompare(b.dispenser_name) || a.nozzle_name.localeCompare(b.nozzle_name);
    });
  }, [bulkForm, customNozzleOrder]);

  // Sync settings from backend
  const settingsQuery = useQuery({
    queryKey: ["settings", "meter_readings"],
    queryFn: async () => {
      const [backendPerTank, backendDefaultTesting, backendNozzleOrder, backendMaintenance] = await Promise.all([
        settingService.getSetting<Record<string, number>>("per_tank_testing_map"),
        settingService.getSetting<Record<string, number>>("default_fuel_testing"),
        settingService.getSetting<string[]>("meter_nozzle_custom_order"),
        settingService.getSetting<Record<string, boolean>>("nozzle_maintenance_status"),
      ]);
      return {
        perTank: backendPerTank,
        defaultTesting: backendDefaultTesting,
        nozzleOrder: backendNozzleOrder,
        maintenance: backendMaintenance,
      };
    },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      if (settingsQuery.data.perTank) {
        setPerTankTestingMap(settingsQuery.data.perTank);
        localStorage.setItem("per_tank_testing_map", JSON.stringify(settingsQuery.data.perTank));
      }
      if (settingsQuery.data.defaultTesting) {
        setFuelTestingMap(settingsQuery.data.defaultTesting);
        localStorage.setItem("default_fuel_testing", JSON.stringify(settingsQuery.data.defaultTesting));
      }
      if (settingsQuery.data.nozzleOrder) {
        setCustomNozzleOrder(settingsQuery.data.nozzleOrder);
        localStorage.setItem("meter_nozzle_custom_order", JSON.stringify(settingsQuery.data.nozzleOrder));
      }
      if (settingsQuery.data.maintenance) {
        setMaintenanceMap(settingsQuery.data.maintenance);
      }
    }
  }, [settingsQuery.data]);

  const toggleNozzleMaintenance = (nozzleUuid: string) => {
    const updated = { ...maintenanceMap, [nozzleUuid]: !maintenanceMap[nozzleUuid] };
    setMaintenanceMap(updated);
    settingService.saveSetting("nozzle_maintenance_status", updated).catch(() => {});
    if (updated[nozzleUuid]) {
      toast.info("Nozzle marked Out of Service / Under Maintenance");
    } else {
      toast.success("Nozzle marked Active & Operational");
    }
  };

  const moveNozzle = (currentIndex: number, direction: "up" | "down") => {
    if (!sortedBulkItems || sortedBulkItems.length === 0) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedBulkItems.length) return;

    const reordered = [...sortedBulkItems];
    const temp = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const newUuidOrder = reordered.map((item) => item.nozzle_uuid);
    setCustomNozzleOrder(newUuidOrder);
    localStorage.setItem("meter_nozzle_custom_order", JSON.stringify(newUuidOrder));
    settingService.saveSetting("meter_nozzle_custom_order", newUuidOrder).catch((err) => {
      console.error("Failed to sync nozzle order to backend:", err);
    });
  };

  // Check if all active nozzles have 6 AM row expanded
  const all6amExpanded = useMemo(() => {
    if (!bulkForm || bulkForm.items.length === 0) return false;
    return bulkForm.items.every((item) => expanded6am[item.nozzle_uuid]);
  }, [bulkForm, expanded6am]);

  // Toggle 6 AM rows for all nozzles
  const handleToggleAll6am = () => {
    if (!bulkForm) return;
    const nextVal = !all6amExpanded;
    const newExpanded: Record<string, boolean> = {};
    bulkForm.items.forEach((item) => {
      newExpanded[item.nozzle_uuid] = nextVal;
    });
    setExpanded6am(newExpanded);
  };

  // Query: fuel tanks list
  const { data: tanks } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  // Daily Fuel Storage Testing carry-over state
  const DEFAULT_FUEL_TESTING: Record<string, number> = {
    DIESEL: 20,
    PETROL: 10,
    SPEED: 10,
  };

  const [fuelTestingMap, setFuelTestingMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("default_fuel_testing");
      return saved ? JSON.parse(saved) : DEFAULT_FUEL_TESTING;
    } catch {
      return DEFAULT_FUEL_TESTING;
    }
  });

  const [perTankTestingMap, setPerTankTestingMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("per_tank_testing_map");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateFuelTesting = (fuelType: string, val: number) => {
    const updated = { ...fuelTestingMap, [fuelType]: val };
    setFuelTestingMap(updated);
    localStorage.setItem("default_fuel_testing", JSON.stringify(updated));
    settingService.saveSetting("default_fuel_testing", updated).catch(() => {});
    if (val > 0) {
      setGlobalReturnTestingToStorage(true);
    }
  };

  const handleUpdatePerTankTesting = (tankUuid: string, fuelType: string, val: number) => {
    const nextTankMap = { ...perTankTestingMap, [tankUuid]: val };
    setPerTankTestingMap(nextTankMap);
    localStorage.setItem("per_tank_testing_map", JSON.stringify(nextTankMap));
    settingService.saveSetting("per_tank_testing_map", nextTankMap).catch(() => {});
    if (val > 0) {
      setGlobalReturnTestingToStorage(true);
    }

    // Aggregate total testing liters per fuel type across tanks
    const aggregatedByFuel: Record<string, number> = { DIESEL: 0, PETROL: 0, SPEED: 0 };
    if (tanks && tanks.length > 0) {
      tanks.forEach((tank) => {
        const ft = tank.fuel_type.toUpperCase();
        const tVal = tank.uuid === tankUuid ? val : (nextTankMap[tank.uuid] ?? 0);
        let normalizedKey = "PETROL";
        if (ft.includes("DIESEL") || ft.includes("HSD")) normalizedKey = "DIESEL";
        else if (ft.includes("SPEED")) normalizedKey = "SPEED";
        else if (ft.includes("PETROL") || ft.includes("MS")) normalizedKey = "PETROL";
        else normalizedKey = ft;

        aggregatedByFuel[normalizedKey] = (aggregatedByFuel[normalizedKey] || 0) + tVal;
      });
    } else {
      let normalizedKey = "PETROL";
      const ft = fuelType.toUpperCase();
      if (ft.includes("DIESEL") || ft.includes("HSD")) normalizedKey = "DIESEL";
      else if (ft.includes("SPEED")) normalizedKey = "SPEED";
      aggregatedByFuel[normalizedKey] = val;
    }

    const nextFuelMap = { ...fuelTestingMap, ...aggregatedByFuel };
    setFuelTestingMap(nextFuelMap);
    localStorage.setItem("default_fuel_testing", JSON.stringify(nextFuelMap));
    settingService.saveSetting("default_fuel_testing", nextFuelMap).catch(() => {});
  };

  // Sync bulk reading form items into local state when data is loaded
  useEffect(() => {
    if (bulkForm?.items) {
      const initialMap: Record<
        string,
        {
          opening: string | number;
          closing: string | number;
          interim6am: string | number;
          testing: string | number;
          sales: string;
        }
      > = {};
      bulkForm.items.forEach((item) => {
        const openVal = item.opening_reading;
        const closeVal = item.closing_reading;
        const testingL = item.testing !== null ? item.testing : 0.0;
        const salesVal = closeVal !== null ? Math.max(0, closeVal - openVal).toFixed(3) : "";
        initialMap[item.nozzle_uuid] = {
          opening: openVal,
          closing: closeVal !== null ? closeVal : "",
          interim6am: item.interim_6am_reading !== null ? item.interim_6am_reading : "",
          testing: testingL,
          sales: salesVal,
        };
      });
      setFormItems(initialMap);

      // Restore saved times and global testing return flag if present
      if (bulkForm.items.length > 0) {
        if (bulkForm.items[0].opening_time) {
          setSharedOpeningTime(bulkForm.items[0].opening_time);
        }
        if (bulkForm.items[0].closing_time) {
          setSharedClosingTime(bulkForm.items[0].closing_time);
        }
        if (bulkForm.items[0].return_testing_to_storage !== null) {
          setGlobalReturnTestingToStorage(bulkForm.items[0].return_testing_to_storage);
        }
      }

      // Auto-expand 6AM rows if interim reading already saved
      const expanded: Record<string, boolean> = {};
      bulkForm.items.forEach((item) => {
        if (item.interim_6am_reading !== null) {
          expanded[item.nozzle_uuid] = true;
        }
      });
      setExpanded6am(expanded);
    }
  }, [bulkForm]);

  // Reset unlock status when switching logging dates
  useEffect(() => {
    setIsEditingSaved(false);
  }, [readingsDate]);

  // Persist shared times to localStorage when changed
  const handleOpeningTimeChange = (val: string) => {
    setSharedOpeningTime(val);
    localStorage.setItem("meter_reading_opening_time", val);
  };
  const handleClosingTimeChange = (val: string) => {
    setSharedClosingTime(val);
    localStorage.setItem("meter_reading_closing_time", val);
  };

  // Evaluate if there are any saved logs on this date
  const hasSavedReadings = useMemo(() => {
    return bulkForm?.items.some((item) => item.closing_reading !== null) ?? false;
  }, [bulkForm]);

  // Mutation
  const postBulkReadingsMutation = useMutation({
    mutationFn: (data: BulkNozzleReadingCreate) => inventoryService.postBulkReadings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      queryClient.invalidateQueries({ queryKey: ["bulkReadings", readingsDate] });
      queryClient.invalidateQueries({ queryKey: ["nozzleReadingsHistory"] });
      // Readings deduct tank stock, so refresh the Fuel Storage view too.
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["dips"] });
      setIsEditingSaved(false);
      toast.success("All nozzle meter readings saved successfully!");
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to save meter readings.";
      toast.error(msg);
    },
  });

  const handleSaveBulkReadings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkForm) return;

    try {
      const readings = bulkForm.items
        .filter((item) => formItems[item.nozzle_uuid]?.closing !== "")
        .map((item) => {
          const vals = formItems[item.nozzle_uuid];
          const opening = parseFloat(vals.opening.toString());
          const closing = parseFloat(vals.closing.toString());
          const interimRaw = vals.interim6am.toString();
          const interim = interimRaw !== "" ? parseFloat(interimRaw) : null;
          const testingRaw = vals.testing?.toString() || "0";
          const testing = parseFloat(testingRaw) || 0.0;

          if (isNaN(opening) || isNaN(closing)) {
            throw new Error(`Reading values for nozzle ${item.nozzle_name} must be numeric.`);
          }
          const meterCapacity = item.meter_capacity ?? 1000000.0;
          if (closing < opening) {
            const grossSales = (meterCapacity - opening) + closing;
            if (grossSales > meterCapacity * 0.1) {
              throw new Error(`Final meter reading for nozzle ${item.nozzle_name} cannot be less than initial reading (or exceeds safety rollover limits).`);
            }
          }
          if (interim !== null && (interim < opening || interim > closing)) {
            throw new Error(`6 AM reading for nozzle ${item.nozzle_name} must be between the opening and closing readings.`);
          }
          if (isNaN(testing) || testing < 0) {
            throw new Error(`Testing liters for nozzle ${item.nozzle_name} must be a non-negative number.`);
          }

          return {
            nozzle_uuid: item.nozzle_uuid,
            opening_reading: opening,
            closing_reading: closing,
            opening_time: sharedOpeningTime,
            closing_time: sharedClosingTime,
            interim_6am_reading: interim,
            testing_liters: testing,
            return_testing_to_storage: globalReturnTestingToStorage,
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

  const isDisabled = hasSavedReadings && !isEditingSaved;

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <Card className="glass border-hairline p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-fuel-amber/10 text-fuel-amber">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Unified Data Entry Log</h3>
            <p className="text-xs text-ink-subtle">
              Batch submit opening and closing readings for all active nozzles.
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

      {/* Shared Reading Times */}
      <Card className="border-hairline bg-surface-2/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-fuel-amber" />
            <p className="text-xs font-bold text-ink-muted uppercase tracking-wider font-mono">Reading Timestamps</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] text-ink-subtle">Opening Time</Label>
              <Input
                type="time"
                value={sharedOpeningTime}
                onChange={(e) => handleOpeningTimeChange(e.target.value)}
                disabled={isDisabled}
                className="bg-surface-2 border-hairline text-xs text-ink h-8 px-3 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-ink-subtle">Closing Time</Label>
              <Input
                type="time"
                value={sharedClosingTime}
                onChange={(e) => handleClosingTimeChange(e.target.value)}
                disabled={isDisabled}
                className="bg-surface-2 border-hairline text-xs text-ink h-8 px-3 disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            <div className="col-span-2 flex items-end">
              <p className="text-[10px] text-ink-subtle leading-relaxed">
                These times apply to all nozzles. The <strong className="text-fuel-amber">6 AM reading</strong> below is optional —
                only needed when a fuel price changed at 6:00 AM that day.
              </p>
            </div>
          </div>
        </CardContent>
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
              ) : bulkFormError ? (
                <div className="p-12 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-fuel-amber">
                    <AlertTriangle size={16} />
                    <p className="text-xs font-semibold">Couldn't load the meter entry form.</p>
                  </div>
                  <p className="text-[11px] text-ink-subtle max-w-md mx-auto">
                    {(bulkFormErrorObj as any)?.response?.data?.detail ||
                      "The server rejected this request. Your nozzles are still configured — this is a loading error, not a missing setup."}
                  </p>
                  <Button
                    type="button"
                    onClick={() => refetchBulkForm()}
                    className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-semibold text-xs cursor-pointer"
                  >
                    Retry
                  </Button>
                </div>
              ) : bulkForm && bulkForm.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-hairline hover:bg-transparent">
                      <TableHead className="px-2 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-center w-16">
                        Order
                      </TableHead>
                      <TableHead className="px-4 text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Dispenser
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Nozzle Name
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle">
                        Fuel Type
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-40">
                        Opening Reading (L)
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-36">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>6 AM Reading</span>
                          {sortedBulkItems.length > 0 && (
                            <button
                              type="button"
                              onClick={handleToggleAll6am}
                              disabled={isDisabled}
                              className="text-[9px] lowercase bg-fuel-amber/10 hover:bg-fuel-amber/20 text-fuel-amber px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-50 font-sans tracking-normal border border-fuel-amber/20 hover:scale-105 active:scale-95"
                              title={all6amExpanded ? "Collapse 6 AM fields for all nozzles" : "Expand 6 AM fields for all nozzles"}
                            >
                              {all6amExpanded ? "hide all" : "add for all"}
                            </button>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-44">
                        Closing Reading (L)
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-32">
                        Testing (L)
                      </TableHead>
                      <TableHead className="px-5 text-[11px] font-mono uppercase tracking-wider text-ink-subtle text-right w-36">
                        Sales (Liters)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBulkItems.map((item, idx) => {
                      const stateVals = formItems[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                      const openVal = parseFloat(stateVals.opening.toString() || "0");
                      const closeVal = parseFloat(stateVals.closing.toString() || "0");
                      const interimVal = stateVals.interim6am !== "" ? parseFloat(stateVals.interim6am.toString()) : null;
                      // A closing reading equal to the opening reading is a valid
                      // zero-sales day (nozzle unused), not a missing entry — only
                      // treat a blank closing field as "not entered".
                      const closingEntered = stateVals.closing !== "";
                      // closing < opening is invalid (meter can't run backwards);
                      // closing == opening is valid zero sales.
                      const isNegative = closingEntered && closeVal < openVal;
                      const is6amExpanded = expanded6am[item.nozzle_uuid] ?? false;

                      const isMaintenance = maintenanceMap[item.nozzle_uuid] ?? false;

                      // Show split if interim reading entered
                      const before6am = interimVal !== null && !isNaN(interimVal) ? Math.max(0, interimVal - openVal) : null;
                      const after6am = interimVal !== null && !isNaN(interimVal) ? Math.max(0, closeVal - interimVal) : null;

                      return (
                        <TableRow key={item.nozzle_uuid} className={`border-b border-hairline ${isMaintenance ? "bg-fuel-amber/5 opacity-75" : "hover:bg-surface-3/35"}`}>
                          <TableCell className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveNozzle(idx, "up")}
                                disabled={idx === 0 || isDisabled}
                                className="p-1 rounded hover:bg-surface-3 text-ink-muted hover:text-fuel-amber disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors text-[10px] leading-none"
                                title="Move nozzle up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => moveNozzle(idx, "down")}
                                disabled={idx === sortedBulkItems.length - 1 || isDisabled}
                                className="p-1 rounded hover:bg-surface-3 text-ink-muted hover:text-fuel-amber disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed transition-colors text-[10px] leading-none"
                                title="Move nozzle down"
                              >
                                ▼
                              </button>
                              {isAdminOrManager && (
                                <button
                                  type="button"
                                  onClick={() => toggleNozzleMaintenance(item.nozzle_uuid)}
                                  className={`p-1 rounded hover:bg-surface-3 transition-colors cursor-pointer ${
                                    isMaintenance ? "text-fuel-amber" : "text-ink-subtle hover:text-fuel-amber"
                                  }`}
                                  title={isMaintenance ? "Mark Active & Operational" : "Mark Out of Service / Under Maintenance"}
                                >
                                  <Wrench size={13} />
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 text-xs font-bold text-ink">
                            {item.dispenser_name}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-ink-muted">
                            <div className="flex items-center gap-1.5">
                              <span>{item.nozzle_name}</span>
                              {isMaintenance && (
                                <Badge className="text-[8px] bg-fuel-amber/20 text-fuel-amber border-fuel-amber/40">
                                  MAINTENANCE
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-ink-muted">
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber hover:bg-fuel-amber/15 border-transparent">
                              {item.fuel_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="0.000"
                              disabled={isDisabled || isMaintenance}
                              value={stateVals.opening}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                                  const openVal = parseFloat(raw || "0");
                                  const closeVal = parseFloat(prevItem.closing?.toString() || "0");
                                  const salesVal = prevItem.closing === "" ? "" : Math.max(0, closeVal - openVal).toFixed(3);
                                  return {
                                    ...prev,
                                    [item.nozzle_uuid]: {
                                      ...prevItem,
                                      opening: raw,
                                      sales: salesVal,
                                    },
                                  };
                                });
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                }
                              }}
                              className="w-32 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed"
                            />
                          </TableCell>
                          <TableCell className="py-2.5">
                            {/* 6 AM Interim Reading — expandable */}
                            {is6amExpanded ? (
                              <div className="flex items-center gap-1">
                                <div className="relative">
                                  <Sunrise size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-fuel-amber" />
                                  <Input
                                    id={`interim-input-${idx}`}
                                    type="number"
                                    step="0.001"
                                    placeholder="6:00 AM reading"
                                    value={stateVals.interim6am}
                                    onChange={(e) => {
                                      setFormItems((prev) => ({
                                        ...prev,
                                        [item.nozzle_uuid]: {
                                          ...prev[item.nozzle_uuid],
                                          interim6am: e.target.value,
                                        },
                                      }));
                                    }}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onKeyDown={(e) => {
                                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                      }
                                    }}
                                    disabled={isDisabled}
                                    className="w-36 pl-6 bg-fuel-amber/5 border-fuel-amber/30 outline-none text-xs text-ink py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpanded6am((p) => ({ ...p, [item.nozzle_uuid]: false }));
                                    setFormItems((prev) => ({
                                      ...prev,
                                      [item.nozzle_uuid]: { ...prev[item.nozzle_uuid], interim6am: "" },
                                    }));
                                  }}
                                  disabled={isDisabled}
                                  className="text-ink-subtle hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                                  title="Remove 6 AM reading"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpanded6am((p) => ({ ...p, [item.nozzle_uuid]: true }))}
                                disabled={isDisabled}
                                className="flex items-center gap-1 text-[10px] text-ink-subtle hover:text-fuel-amber transition-colors font-semibold cursor-pointer disabled:opacity-50 group"
                                title="Add 6 AM interim reading (optional, only if price changed today)"
                              >
                                <ChevronRight size={11} className="group-hover:hidden" />
                                <ChevronDown size={11} className="hidden group-hover:block" />
                                <Sunrise size={11} />
                                Add 6 AM
                              </button>
                            )}
                            {/* Split preview */}
                            {before6am !== null && after6am !== null && (
                              <div className="mt-1 text-[9px] text-ink-subtle space-y-0.5">
                                <span className="text-ink-muted">Before: {before6am.toFixed(3)} L</span>
                                <span className="text-ink-muted block">After: {after6am.toFixed(3)} L</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Input
                              id={`closing-input-${idx}`}
                              type="number"
                              step="0.001"
                              placeholder="Enter final reading"
                              value={stateVals.closing}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                                  const openVal = parseFloat(prevItem.opening?.toString() || "0");
                                  const closeVal = parseFloat(raw || "0");
                                  const salesVal = raw === "" ? "" : Math.max(0, closeVal - openVal).toFixed(3);
                                  return {
                                    ...prev,
                                    [item.nozzle_uuid]: {
                                      ...prevItem,
                                      closing: raw,
                                      sales: salesVal,
                                    },
                                  };
                                });
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                }
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const nextInput = document.getElementById(`closing-input-${idx + 1}`) as HTMLInputElement | null;
                                  if (nextInput) {
                                    nextInput.focus();
                                    nextInput.select();
                                  }
                                }
                              }}
                              disabled={isDisabled || isMaintenance}
                              className="w-36 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed"
                            />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="0.000"
                              value={stateVals.testing}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const val = parseFloat(raw || "0");
                                if (val > 0) {
                                  setGlobalReturnTestingToStorage(true);
                                }
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                                  const openVal = parseFloat(prevItem.opening?.toString() || "0");
                                  const testingVal = parseFloat(raw || "0");
                                  const salesVal = parseFloat(prevItem.sales?.toString() || "0");
                                  const closingVal = prevItem.sales === "" ? "" : Math.max(0, openVal + salesVal - testingVal).toFixed(3);
                                  return {
                                    ...prev,
                                    [item.nozzle_uuid]: {
                                      ...prevItem,
                                      testing: raw,
                                      closing: closingVal,
                                    },
                                  };
                                });
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                }
                              }}
                              disabled={isDisabled}
                              className="w-24 bg-surface-2 border-hairline outline-none text-xs text-ink py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed"
                            />
                          </TableCell>
                          <TableCell className="px-5 py-2.5 text-right">
                            {/* Sales is editable: entering sales back-calculates
                                closing = opening + sales + testing. closing stays the source
                                of truth, so this input just derives from/writes to it. */}
                            <Input
                              type="number"
                              step="0.001"
                              placeholder="0.000"
                              value={stateVals.sales || ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                                  const openVal = parseFloat(prevItem.opening?.toString() || "0");
                                  const testingVal = parseFloat(prevItem.testing?.toString() || "0");
                                  const salesVal = parseFloat(raw || "0");
                                  const closingVal = raw === "" ? "" : Math.max(0, openVal + salesVal - testingVal).toFixed(3);
                                  return {
                                    ...prev,
                                    [item.nozzle_uuid]: {
                                      ...prevItem,
                                      sales: raw,
                                      closing: closingVal,
                                    },
                                  };
                                });
                              }}
                              onBlur={() => {
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid];
                                  if (!prevItem || prevItem.sales === "") return prev;
                                  const formatted = parseFloat(prevItem.sales).toFixed(3);
                                  return {
                                    ...prev,
                                    [item.nozzle_uuid]: {
                                      ...prevItem,
                                      sales: formatted,
                                    },
                                  };
                                });
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                }
                              }}
                              disabled={isDisabled}
                              title={isNegative ? "Sales cannot be negative — closing is below opening." : undefined}
                              className={`w-28 text-right bg-surface-2 border-hairline outline-none text-xs py-1 h-8 disabled:opacity-70 disabled:cursor-not-allowed ${isNegative ? "border-red-400/60 text-red-400 font-bold" : "text-ink"}`}
                            />
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

            {/* Fuel Storage & Testing Configuration */}
            <Card className="glass border-hairline mt-6">
              <CardHeader className="pb-3 border-b border-hairline">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Fuel size={16} className="text-fuel-amber" />
                    <div>
                      <CardTitle className="text-sm font-bold text-ink">Fuel Storage &amp; Testing (Liters)</CardTitle>
                      <CardDescription className="text-[11px] text-ink-subtle">
                        Configure testing liters for fuel storage tanks. Carries over to everyday by default until changed.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-fuel-amber/15 text-fuel-amber border-transparent font-mono text-[10px]">
                    Active Date: {readingsDate}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {tanks && tanks.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tanks.map((tank) => {
                      const fuelTypeKey = tank.fuel_type.toUpperCase();
                      const currentVal =
                        perTankTestingMap[tank.uuid] !== undefined
                          ? perTankTestingMap[tank.uuid]
                          : (fuelTestingMap[fuelTypeKey] ?? (fuelTypeKey === "DIESEL" ? 20 : 10));
                      const isLocked = hasSavedReadings && !isEditingSaved;
                      return (
                        <div key={tank.uuid} className="rounded-xl border border-hairline bg-surface-2 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink">{tank.name}</span>
                            <Badge className="text-[9px] uppercase font-mono font-bold bg-fuel-amber/15 text-fuel-amber border-transparent">
                              {tank.fuel_type}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-ink-subtle">
                            <span>Capacity: {tank.capacity_liters.toLocaleString()} L</span>
                            <span className="font-mono font-semibold text-ink">Stock: {tank.current_stock_liters.toLocaleString()} L</span>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-hairline/40">
                            <span className="text-xs text-ink-muted shrink-0 font-medium">Testing Qty:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              disabled={isLocked}
                              value={currentVal}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                handleUpdatePerTankTesting(tank.uuid, fuelTypeKey, val);
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                }
                              }}
                              className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1 text-right font-mono font-bold text-xs text-fuel-amber outline-none focus:border-fuel-amber disabled:opacity-70 disabled:cursor-not-allowed"
                              placeholder="0.0"
                            />
                            <span className="text-xs font-bold text-ink-muted">L</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { type: "DIESEL", label: "H.S.D Storage Tank (Diesel)" },
                      { type: "PETROL", label: "M.S Storage Tank (Petrol)" },
                      { type: "SPEED", label: "Speed Storage Tank" },
                    ].map(({ type, label }) => {
                      const currentVal = fuelTestingMap[type] ?? (type === "DIESEL" ? 20 : 10);
                      const isLocked = hasSavedReadings && !isEditingSaved;
                      return (
                        <div key={type} className="rounded-xl border border-hairline bg-surface-2 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink">{label}</span>
                            <Badge className="text-[9px] font-mono bg-surface-3 text-ink-muted border-transparent">
                              {type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-ink-muted shrink-0 font-medium">Testing Qty:</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              disabled={isLocked}
                              value={currentVal}
                              onChange={(e) => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                handleUpdateFuelTesting(type, val);
                              }}
                              onWheel={(e) => e.currentTarget.blur()}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                }
                              }}
                              className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1 text-right font-mono font-bold text-xs text-fuel-amber outline-none focus:border-fuel-amber disabled:opacity-70 disabled:cursor-not-allowed"
                              placeholder="0.0"
                            />
                            <span className="text-xs font-bold text-ink-muted">L</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 pb-2 border-t border-hairline/30 mt-6 px-4">
                {/* Global option for testing return */}
                <div className="flex items-center gap-2.5 select-none">
                  <input
                    id="globalTestingReturn"
                    type="checkbox"
                    checked={globalReturnTestingToStorage}
                    onChange={(e) => setGlobalReturnTestingToStorage(e.target.checked)}
                    disabled={isDisabled}
                    className="h-4.5 w-4.5 rounded border-hairline bg-surface-2 text-fuel-amber focus:ring-fuel-amber/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <Label htmlFor="globalTestingReturn" className="text-xs font-semibold text-ink cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                    Return testing fuel to storage tanks (Do not deduct testing liters from storage stock)
                  </Label>
                </div>

                <div className="flex justify-end gap-2">
                  {hasSavedReadings && !isEditingSaved ? (
                    <Button
                      type="button"
                      onClick={() => setUnlockConfirmOpen(true)}
                      className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-8 py-2.5 shadow-md cursor-pointer text-xs"
                    >
                      Edit Saved Readings
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={postBulkReadingsMutation.isPending}
                      className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold px-8 py-2.5 shadow-md cursor-pointer text-xs"
                    >
                      {postBulkReadingsMutation.isPending ? "Saving changes..." : hasSavedReadings ? "Save Changes" : "Save All Readings"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </form>

      {/* Unlock Confirmation Dialog */}
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
                {new Date(readingsDate).toLocaleDateString("en-GB", {
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
              Confirm &amp; Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
