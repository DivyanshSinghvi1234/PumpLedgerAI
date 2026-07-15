import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Fuel, Plus, Edit2, Trash2, AlertTriangle, Calculator } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import inventoryService from "../services/inventoryService";
import type { FuelType, FuelDispenserCreate, NozzleCreate } from "../types";

export default function DispenserTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  // Dialog open states
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

  // Queries
  const { data: dispensers, isLoading: dispensersLoading, isError: dispensersError } = useQuery({
    queryKey: ["dispensers"],
    queryFn: () => inventoryService.getDispensers(),
  });

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
    },
  });

  // Submit Handlers
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

  if (dispensersLoading) {
    return <div className="py-12 text-center text-xs text-ink-subtle">Loading dispensers...</div>;
  }

  if (dispensersError) {
    return (
      <Card className="border-dashed border-hairline bg-transparent p-6 text-center">
        <Fuel className="mx-auto text-ink-subtle mb-3" size={32} />
        <p className="text-sm font-medium text-ink">Unable to load dispenser inventory data.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Add Button (Mounted inside the main page, but triggers dispenser dialog) */}
      {isAdminOrManager && (
        <div className="flex justify-end -mt-12 mb-6">
          <Button
            onClick={() => setDispenserDialogOpen(true)}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15 cursor-pointer"
          >
            <Plus size={16} className="mr-2" /> Add Fuel Dispenser
          </Button>
        </div>
      )}

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
    </div>
  );
}
