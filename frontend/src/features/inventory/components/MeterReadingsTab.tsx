import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Calendar, AlertTriangle, Sunrise, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import inventoryService from "../services/inventoryService";
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
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);

  // Shared times for all nozzles (operator takes readings together)
  const [sharedOpeningTime, setSharedOpeningTime] = useState(
    () => localStorage.getItem("meter_reading_opening_time") || "19:30"
  );
  const [sharedClosingTime, setSharedClosingTime] = useState(
    () => localStorage.getItem("meter_reading_closing_time") || "19:30"
  );

  // Which nozzles have the 6 AM interim reading row expanded
  const [expanded6am, setExpanded6am] = useState<Record<string, boolean>>({});

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
        const salesVal = closeVal !== null ? Math.max(0, closeVal - openVal - testingL).toFixed(3) : "";
        initialMap[item.nozzle_uuid] = {
          opening: openVal,
          closing: closeVal !== null ? closeVal : "",
          interim6am: item.interim_6am_reading !== null ? item.interim_6am_reading : "",
          testing: testingL,
          sales: salesVal,
        };
      });
      setFormItems(initialMap);

      // Restore saved times if present
      if (bulkForm.items.length > 0 && bulkForm.items[0].opening_time) {
        setSharedOpeningTime(bulkForm.items[0].opening_time);
      }
      if (bulkForm.items.length > 0 && bulkForm.items[0].closing_time) {
        setSharedClosingTime(bulkForm.items[0].closing_time);
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
          if (closing < opening) {
            throw new Error(`Final meter reading for nozzle ${item.nozzle_name} cannot be less than initial reading.`);
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
                        Opening Reading (L)
                      </TableHead>
                      <TableHead className="text-[11px] font-mono uppercase tracking-wider text-ink-subtle w-36">
                        <div className="flex items-center justify-between gap-1.5">
                          <span>6 AM Reading</span>
                          {bulkForm && bulkForm.items.length > 0 && (
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
                    {bulkForm.items.map((item, idx) => {
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

                      // Show split if interim reading entered
                      const before6am = interimVal !== null && !isNaN(interimVal) ? Math.max(0, interimVal - openVal) : null;
                      const after6am = interimVal !== null && !isNaN(interimVal) ? Math.max(0, closeVal - interimVal) : null;

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
                              step="0.001"
                              placeholder="0.000"
                              value={stateVals.opening}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                                  const openVal = parseFloat(raw || "0");
                                  const closeVal = parseFloat(prevItem.closing?.toString() || "0");
                                  const testingVal = parseFloat(prevItem.testing?.toString() || "0");
                                  const salesVal = prevItem.closing === "" ? "" : Math.max(0, closeVal - openVal - testingVal).toFixed(3);
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
                              disabled={isDisabled}
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
                                  const testingVal = parseFloat(prevItem.testing?.toString() || "0");
                                  const salesVal = raw === "" ? "" : Math.max(0, closeVal - openVal - testingVal).toFixed(3);
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
                              disabled={isDisabled}
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
                                setFormItems((prev) => {
                                  const prevItem = prev[item.nozzle_uuid] || { opening: "", closing: "", interim6am: "", testing: 0.0, sales: "" };
                                  const openVal = parseFloat(prevItem.opening?.toString() || "0");
                                  const closeVal = parseFloat(prevItem.closing?.toString() || "0");
                                  const testingVal = parseFloat(raw || "0");
                                  const salesVal = prevItem.closing === "" ? "" : Math.max(0, closeVal - openVal - testingVal).toFixed(3);
                                  return {
                                    ...prev,
                                    [item.nozzle_uuid]: {
                                      ...prevItem,
                                      testing: raw,
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
                                  const closingVal = raw === "" ? "" : (openVal + salesVal + testingVal).toFixed(3);
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
