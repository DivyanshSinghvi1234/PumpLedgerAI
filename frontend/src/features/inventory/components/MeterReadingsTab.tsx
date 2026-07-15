import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Calendar, AlertTriangle } from "lucide-react";
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
  const [formItems, setFormItems] = useState<Record<string, { opening: string | number; closing: string | number }>>({});
  const [isEditingSaved, setIsEditingSaved] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);

  // Query: bulk form readings for the selected date
  const { data: bulkForm, isLoading: bulkFormLoading } = useQuery({
    queryKey: ["bulkReadings", readingsDate],
    queryFn: () => inventoryService.getBulkReadingsForm(readingsDate),
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

  // Reset unlock status when switching logging dates
  useEffect(() => {
    setIsEditingSaved(false);
  }, [readingsDate]);

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

          if (isNaN(opening) || isNaN(closing)) {
            throw new Error(`Reading values for nozzle ${item.nozzle_name} must be numeric.`);
          }
          if (closing < opening) {
            throw new Error(`Final meter reading for nozzle ${item.nozzle_name} cannot be less than initial reading.`);
          }

          return {
            nozzle_uuid: item.nozzle_uuid,
            opening_reading: opening,
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

  return (
    <div className="space-y-6">
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
