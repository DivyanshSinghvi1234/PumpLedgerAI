import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck, Plus, CheckCircle, Clock, AlertCircle, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import inventoryService from "../services/inventoryService";
import type {
  PurchaseIndent,
  PurchaseIndentCreate,
  PurchaseIndentStatusUpdate,
  OMCCompany,
  FuelType,
} from "../types";


export default function PurchaseIndentsTab({ isAdminOrManager }: { isAdminOrManager: boolean }) {
  const queryClient = useQueryClient();

  // Modal States
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState<PurchaseIndent | null>(null);

  // Form Fields - Create
  const [omcCompany, setOmcCompany] = useState<OMCCompany>("IOCL");
  const [terminalName, setTerminalName] = useState("Koyali Terminal");
  const [fuelType, setFuelType] = useState<FuelType>("PETROL");
  const [orderedLiters, setOrderedLiters] = useState("");
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [procurementCost, setProcurementCost] = useState("");
  const [createRemarks, setCreateRemarks] = useState("");

  // Form Fields - Dispatch
  const [tankTruckNum, setTankTruckNum] = useState("");

  // Form Fields - Deliver & Decant
  const [actualDate, setActualDate] = useState(new Date().toISOString().split("T")[0]);
  const [decantedTankUuid, setDecantedTankUuid] = useState("");
  const [density15c, setDensity15c] = useState("");
  const [invoiceNum, setInvoiceNum] = useState("");
  const [totalInvoiceAmt, setTotalInvoiceAmt] = useState("");
  const [deliverRemarks, setDeliverRemarks] = useState("");

  // Queries
  const { data: indents, isLoading, isError, refetch } = useQuery({
    queryKey: ["purchase-indents"],
    queryFn: () => inventoryService.getPurchaseIndents(),
  });

  const { data: tanks } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  // Mutations
  const createIndentMutation = useMutation({
    mutationFn: (data: PurchaseIndentCreate) => inventoryService.createPurchaseIndent(data),
    onSuccess: () => {
      toast.success("OMC Purchase Indent created successfully!");
      setCreateDialogOpen(false);
      setOrderedLiters("");
      setProcurementCost("");
      setCreateRemarks("");
      queryClient.invalidateQueries({ queryKey: ["purchase-indents"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to create purchase indent.");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: PurchaseIndentStatusUpdate }) =>
      inventoryService.updatePurchaseIndentStatus(uuid, data),
    onSuccess: (_, variables) => {
      if (variables.data.status === "DELIVERED") {
        toast.success("TT Delivered & Fuel Decanted into Storage Tank!");
      } else {
        toast.success("Purchase Indent status updated!");
      }
      setDispatchDialogOpen(false);
      setDeliverDialogOpen(false);
      setSelectedIndent(null);
      queryClient.invalidateQueries({ queryKey: ["purchase-indents"] });
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update status.");
    },
  });

  const deleteIndentMutation = useMutation({
    mutationFn: (uuid: string) => inventoryService.deletePurchaseIndent(uuid),
    onSuccess: () => {
      toast.success("Purchase Indent cancelled.");
      queryClient.invalidateQueries({ queryKey: ["purchase-indents"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to cancel indent.");
    },
  });

  const openDispatch = (indent: PurchaseIndent) => {
    setSelectedIndent(indent);
    setTankTruckNum(indent.tank_truck_number || "");
    setDispatchDialogOpen(true);
  };

  const openDeliver = (indent: PurchaseIndent) => {
    setSelectedIndent(indent);
    // Auto-select tank matching fuel_type if available
    const matchingTank = tanks?.find((t) => t.fuel_type === indent.fuel_type);
    setDecantedTankUuid(matchingTank ? matchingTank.uuid : tanks?.[0]?.uuid || "");
    setDensity15c(indent.density_at_15c ? String(indent.density_at_15c) : "");
    setInvoiceNum(indent.invoice_number || indent.indent_number);
    setTotalInvoiceAmt(indent.total_invoice_amount ? String(indent.total_invoice_amount) : "");
    setDeliverDialogOpen(true);
  };

  // Summaries
  const activeIndents = indents?.filter((i) => i.status === "INDENTED" || i.status === "DISPATCHED") || [];
  const inTransitTTs = indents?.filter((i) => i.status === "DISPATCHED") || [];
  const deliveredToday = indents?.filter((i) => i.status === "DELIVERED") || [];

  return (
    <div className="space-y-6">
      {/* Top Header & New Indent Button */}
      {isAdminOrManager && (
        <div className="flex justify-end items-center gap-2 -mt-12 mb-6">
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-medium shadow-md shadow-fuel-amber/15 cursor-pointer text-xs h-9"
          >
            <Plus size={16} className="mr-2" /> New OMC Purchase Indent
          </Button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-ink-subtle flex items-center justify-between">
              Pending Indents
              <Clock size={16} className="text-fuel-amber" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ink font-mono">
              {activeIndents.length} <span className="text-xs font-normal text-ink-muted">Orders</span>
            </div>
            <p className="text-[11px] text-ink-subtle mt-1">
              Total volume: {activeIndents.reduce((acc, i) => acc + i.ordered_liters, 0).toLocaleString()} L
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-ink-subtle flex items-center justify-between">
              Tank Trucks in Transit
              <Truck size={16} className="text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ink font-mono">
              {inTransitTTs.length} <span className="text-xs font-normal text-ink-muted">TT Trucks</span>
            </div>
            <p className="text-[11px] text-ink-subtle mt-1">
              Expected at station today
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-hairline">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-ink-subtle flex items-center justify-between">
              Delivered & Decanted
              <CheckCircle size={16} className="text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500 font-mono">
              {deliveredToday.reduce((acc, i) => acc + i.ordered_liters, 0).toLocaleString()} <span className="text-xs font-normal text-ink-muted">Liters</span>
            </div>
            <p className="text-[11px] text-ink-subtle mt-1">
              Across {deliveredToday.length} completed drops
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table View */}
      <Card className="glass border-hairline overflow-hidden">
        <CardHeader className="bg-surface-2/60 border-b border-hairline py-4">
          <CardTitle className="text-sm font-bold text-ink flex items-center gap-2">
            <Truck size={16} className="text-fuel-amber" /> OMC Terminal Purchase Indents & Delivery Pipeline
          </CardTitle>
          <CardDescription className="text-xs text-ink-subtle mt-0.5">
            Track bulk fuel orders placed with Oil Companies (IOCL, BPCL, HPCL) through terminal dispatch and tank decanting
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink-subtle animate-pulse">
              Loading purchase indents...
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-xs text-red-400 space-y-2">
              <AlertCircle size={20} className="mx-auto" />
              <p>Failed to load purchase indents.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs">Retry</Button>
            </div>
          ) : !indents || indents.length === 0 ? (
            <div className="p-12 text-center text-xs text-ink-subtle italic">
              No purchase indents recorded yet. Click "New OMC Purchase Indent" to record a bulk fuel order.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-hairline hover:bg-transparent">
                    <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Indent #</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">OMC / Terminal</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Fuel & Volume</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">TT Vehicle #</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle">Expected Date</TableHead>
                    <TableHead className="text-[10px] font-mono uppercase tracking-wider text-ink-subtle font-center">Status</TableHead>
                    <TableHead className="px-5 text-[10px] font-mono uppercase tracking-wider text-ink-subtle text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indents.map((ind) => {
                    let statusBadge = (
                      <Badge className="text-[9px] bg-fuel-amber/15 text-fuel-amber border-transparent font-bold">
                        INDENTED
                      </Badge>
                    );
                    if (ind.status === "DISPATCHED") {
                      statusBadge = (
                        <Badge className="text-[9px] bg-blue-500/15 text-blue-500 border-transparent font-bold animate-pulse">
                          🚚 DISPATCHED (IN TRANSIT)
                        </Badge>
                      );
                    } else if (ind.status === "DELIVERED") {
                      statusBadge = (
                        <Badge className="text-[9px] bg-emerald-500/15 text-emerald-500 border-transparent font-bold">
                          ✓ DELIVERED & DECANTED
                        </Badge>
                      );
                    } else if (ind.status === "CANCELLED") {
                      statusBadge = (
                        <Badge className="text-[9px] bg-red-500/15 text-red-500 border-transparent font-bold">
                          CANCELLED
                        </Badge>
                      );
                    }

                    return (
                      <TableRow key={ind.uuid} className="border-b border-hairline hover:bg-surface-3/35">
                        <TableCell className="px-5 text-xs font-mono font-bold text-ink">
                          {ind.indent_number}
                        </TableCell>
                        <TableCell className="text-xs text-ink font-semibold">
                          {ind.omc_company}
                          <span className="block text-[10px] text-ink-subtle font-normal">{ind.terminal_name}</span>
                        </TableCell>
                        <TableCell className="text-xs text-ink font-bold">
                          {ind.ordered_liters.toLocaleString()} L
                          <Badge className="text-[8px] ml-1.5 bg-surface-2 text-ink-muted border-hairline">
                            {ind.fuel_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono font-semibold text-ink-muted">
                          {ind.tank_truck_number || <span className="italic text-ink-subtle">Unassigned</span>}
                        </TableCell>
                        <TableCell className="text-xs text-ink-muted">
                          {new Date(ind.expected_delivery_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {statusBadge}
                          {ind.decanted_tank_name && (
                            <span className="block text-[10px] text-emerald-400 font-semibold mt-0.5">
                              Decanted into: {ind.decanted_tank_name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 text-right space-x-1">
                          {isAdminOrManager && ind.status === "INDENTED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDispatch(ind)}
                              className="h-7 text-xs border-hairline text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 cursor-pointer"
                            >
                              Dispatch TT
                            </Button>
                          )}
                          {isAdminOrManager && (ind.status === "INDENTED" || ind.status === "DISPATCHED") && (
                            <Button
                              size="sm"
                              onClick={() => openDeliver(ind)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer font-bold"
                            >
                              Decant & Deliver
                            </Button>
                          )}
                          {isAdminOrManager && ind.status !== "DELIVERED" && ind.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Cancel purchase indent ${ind.indent_number}?`)) {
                                  deleteIndentMutation.mutate(ind.uuid);
                                }
                              }}
                              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Purchase Indent Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <Truck size={18} className="text-fuel-amber" /> Create OMC Purchase Indent
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Place a bulk fuel purchase order with Oil Marketing Company supply terminals
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const qty = parseFloat(orderedLiters);
              if (isNaN(qty) || qty <= 0) {
                toast.error("Please enter a valid order volume.");
                return;
              }
              const cost = procurementCost.trim() ? parseFloat(procurementCost) : undefined;
              createIndentMutation.mutate({
                omc_company: omcCompany,
                terminal_name: terminalName.trim(),
                fuel_type: fuelType,
                ordered_liters: qty,
                expected_delivery_date: expectedDate,
                procurement_cost_per_liter: cost,
                remarks: createRemarks.trim() || undefined,
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Oil Marketing Company</Label>
                <select
                  value={omcCompany}
                  onChange={(e) => setOmcCompany(e.target.value as OMCCompany)}
                  className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="IOCL">Indian Oil (IOCL)</option>
                  <option value="BPCL">Bharat Petroleum (BPCL)</option>
                  <option value="HPCL">Hindustan Petroleum (HPCL)</option>
                  <option value="RELIANCE">Reliance Petroleum</option>
                  <option value="SHELL">Shell India</option>
                  <option value="NAYARA">Nayara Energy</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Terminal / Supply Depot</Label>
                <Input
                  placeholder="e.g. Koyali Terminal"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Fuel Type</Label>
                <select
                  value={fuelType}
                  onChange={(e) => setFuelType(e.target.value as FuelType)}
                  className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink outline-none"
                >
                  <option value="PETROL">Petrol (MS)</option>
                  <option value="DIESEL">Diesel (HSD)</option>
                  <option value="SPEED">Speed Petrol</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Ordered Volume (Liters)</Label>
                <Input
                  type="number"
                  step="100"
                  placeholder="e.g. 12000"
                  value={orderedLiters}
                  onChange={(e) => setOrderedLiters(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Procurement Rate (₹/L) <span className="font-normal text-ink-subtle">(optional)</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 88.50"
                  value={procurementCost}
                  onChange={(e) => setProcurementCost(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-ink-muted">Remarks <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                placeholder="e.g. Indented for weekend holiday rush"
                value={createRemarks}
                onChange={(e) => setCreateRemarks(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button type="button" variant="ghost" onClick={() => setCreateDialogOpen(false)} className="text-xs h-9 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={createIndentMutation.isPending} className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-xs h-9 cursor-pointer">
                {createIndentMutation.isPending ? "Creating..." : "Place OMC Indent"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dispatch TT Dialog */}
      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-ink flex items-center gap-2">
              <Truck size={16} className="text-blue-500" /> Assign Tank Truck (TT) Vehicle
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedIndent) return;
              updateStatusMutation.mutate({
                uuid: selectedIndent.uuid,
                data: {
                  status: "DISPATCHED",
                  tank_truck_number: tankTruckNum.trim() || undefined,
                },
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-ink-muted">Tank Truck (TT) Registration Number</Label>
              <Input
                placeholder="e.g. GJ-12-AX-8910"
                value={tankTruckNum}
                onChange={(e) => setTankTruckNum(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink font-mono font-bold"
                required
              />
            </div>
            <DialogFooter className="pt-3 border-t border-hairline">
              <Button type="button" variant="ghost" onClick={() => setDispatchDialogOpen(false)} className="text-xs h-9 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={updateStatusMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 cursor-pointer">
                Mark Dispatched
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deliver & Decant Dialog */}
      <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
        <DialogContent className="glass border border-hairline sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-ink flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-500" /> Decant TT & Receive Stock Delivery
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-subtle">
              Verify TT fuel quality density at 15°C and decant into destination storage tank
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedIndent) return;
              if (!decantedTankUuid) {
                toast.error("Please select a destination fuel tank for decanting.");
                return;
              }
              const density = density15c.trim() ? parseFloat(density15c) : undefined;
              const totalAmt = totalInvoiceAmt.trim() ? parseFloat(totalInvoiceAmt) : undefined;

              updateStatusMutation.mutate({
                uuid: selectedIndent.uuid,
                data: {
                  status: "DELIVERED",
                  actual_delivery_date: actualDate,
                  decanted_tank_uuid: decantedTankUuid,
                  density_at_15c: density,
                  invoice_number: invoiceNum.trim() || undefined,
                  total_invoice_amount: totalAmt,
                  remarks: deliverRemarks.trim() || undefined,
                },
              });
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-ink-muted">Destination Fuel Tank (Decanting Into)</Label>
              <select
                value={decantedTankUuid}
                onChange={(e) => setDecantedTankUuid(e.target.value)}
                className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink outline-none"
                required
              >
                {tanks?.map((t) => (
                  <option key={t.uuid} value={t.uuid}>
                    {t.name} ({t.fuel_type}) — Current Stock: {t.current_stock_liters.toFixed(0)} L / Cap: {t.capacity_liters.toFixed(0)} L
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Actual Delivery Date</Label>
                <Input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Verified Density at 15°C (kg/m³)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 745.5 (Petrol) or 832.0 (Diesel)"
                  value={density15c}
                  onChange={(e) => setDensity15c(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">OMC Invoice #</Label>
                <Input
                  placeholder="e.g. INV-908123"
                  value={invoiceNum}
                  onChange={(e) => setInvoiceNum(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ink-muted">Total Invoice Amount (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1062000.00"
                  value={totalInvoiceAmt}
                  onChange={(e) => setTotalInvoiceAmt(e.target.value)}
                  className="bg-surface-2 border-hairline text-xs text-ink"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-ink-muted">Delivery Remarks <span className="font-normal text-ink-subtle">(optional)</span></Label>
              <Input
                placeholder="e.g. TT decanted cleanly, seal verified"
                value={deliverRemarks}
                onChange={(e) => setDeliverRemarks(e.target.value)}
                className="bg-surface-2 border-hairline text-xs text-ink"
              />
            </div>

            {selectedIndent && decantedTankUuid && (

              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs space-y-1 font-mono">
                <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">Automated Stock Increase Preview:</p>
                <p>
                  Adding <strong>+{selectedIndent.ordered_liters.toLocaleString()} L</strong> to{" "}
                  {tanks?.find((t) => t.uuid === decantedTankUuid)?.name || "Selected Tank"}.
                </p>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-hairline">
              <Button type="button" variant="ghost" onClick={() => setDeliverDialogOpen(false)} className="text-xs h-9 cursor-pointer">
                Cancel
              </Button>
              <Button type="submit" disabled={updateStatusMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 cursor-pointer">
                {updateStatusMutation.isPending ? "Decanting..." : "Confirm & Decant Stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
