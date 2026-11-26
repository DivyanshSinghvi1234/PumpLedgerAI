import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Fuel,
  Gauge,
  Map as MapIcon,
  Plus,
  RefreshCw,
  TabletSmartphone,
  Wrench,
} from "lucide-react";

import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import AppDialog from "@/components/common/AppDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import inventoryService from "./services/inventoryService";
import type { BulkFormNozzleItem, FuelTank, FuelType, Nozzle } from "./types";
import { getTodayDateString } from "@/lib/utils";

const FUEL_STYLE: Record<
  FuelType,
  { label: string; badge: string; bar: string; border: string; glow: string; hex: string }
> = {
  PETROL: {
    label: "MS Petrol",
    badge: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
    bar: "from-blue-500 to-cyan-400",
    border: "hover:border-blue-500/60",
    glow: "shadow-blue-500/10",
    hex: "#3b82f6",
  },
  DIESEL: {
    label: "HSD Diesel",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
    bar: "from-amber-500 to-yellow-400",
    border: "hover:border-amber-500/60",
    glow: "shadow-amber-500/10",
    hex: "#f59e0b",
  },
  SPEED: {
    label: "Speed 95",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
    bar: "from-emerald-500 to-teal-400",
    border: "hover:border-emerald-500/60",
    glow: "shadow-emerald-500/10",
    hex: "#10b981",
  },
  LUBRICANT: {
    label: "Lubricant",
    badge: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
    bar: "from-purple-500 to-fuchsia-400",
    border: "hover:border-purple-500/60",
    glow: "shadow-purple-500/10",
    hex: "#8b5cf6",
  },
};

export default function ForecourtTwinPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = getTodayDateString();

  const [selectedNozzle, setSelectedNozzle] = useState<{
    nozzle: Nozzle;
    dispenserName: string;
    bulkItem?: BulkFormNozzleItem;
  } | null>(null);
  const [closingInput, setClosingInput] = useState("");
  const [testingInput, setTestingInput] = useState("0");
  const [isRollover, setIsRollover] = useState(false);

  const [selectedTank, setSelectedTank] = useState<FuelTank | null>(null);
  const [openingDip, setOpeningDip] = useState("");
  const [closingDip, setClosingDip] = useState("");

  const { data: tanks = [], isLoading: tanksLoading } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => inventoryService.getTanks(),
  });

  const { data: forecasts = [] } = useQuery({
    queryKey: ["tank-forecasts"],
    queryFn: () => inventoryService.getTankForecasts(),
  });

  const { data: dispensers = [], isLoading: dispensersLoading } = useQuery({
    queryKey: ["dispensers"],
    queryFn: () => inventoryService.getDispensers(),
  });

  const { data: bulkForm, refetch: refetchBulk } = useQuery({
    queryKey: ["nozzle-bulk-form", today],
    queryFn: () => inventoryService.getBulkReadingsForm(today),
  });

  const bulkMap = useMemo(() => {
    const map = new Map<string, BulkFormNozzleItem>();
    for (const item of bulkForm?.items ?? []) {
      map.set(item.nozzle_uuid, item);
    }
    return map;
  }, [bulkForm]);

  const forecastMap = useMemo(() => {
    const map = new Map<string, (typeof forecasts)[number]>();
    for (const f of forecasts) map.set(f.tank_uuid, f);
    return map;
  }, [forecasts]);

  const saveReadingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedNozzle) return;
      const closing = Number(closingInput);
      if (!Number.isFinite(closing) || closing < 0) {
        throw new Error("Enter a valid closing reading");
      }
      return inventoryService.postBulkReadings({
        reading_date: today,
        readings: [
          {
            nozzle_uuid: selectedNozzle.nozzle.uuid,
            opening_reading:
              selectedNozzle.bulkItem?.opening_reading ?? selectedNozzle.nozzle.last_reading,
            closing_reading: closing,
            testing_liters: Number(testingInput) || 0,
            return_testing_to_storage: true,
            is_rollover: isRollover,
          },
        ],
      });
    },
    onSuccess: () => {
      toast.success("Nozzle meter reading saved!");
      setSelectedNozzle(null);
      queryClient.invalidateQueries({ queryKey: ["dispensers"] });
      queryClient.invalidateQueries({ queryKey: ["nozzle-bulk-form", today] });
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["daily-snapshot", today] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.message || "Failed to save reading");
    },
  });

  const saveDipMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTank) return;
      return inventoryService.postDipReading(selectedTank.uuid, {
        opening_dip_liters: Number(openingDip),
        closing_dip_liters: Number(closingDip),
        reading_date: today,
      });
    },
    onSuccess: () => {
      toast.success("Tank dip reading recorded!");
      setSelectedTank(null);
      queryClient.invalidateQueries({ queryKey: ["tanks"] });
      queryClient.invalidateQueries({ queryKey: ["tank-forecasts"] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to save dip reading");
    },
  });

  if (tanksLoading || dispensersLoading) {
    return <LoadingState />;
  }

  const totalStock = tanks.reduce((acc, t) => acc + t.current_stock_liters, 0);
  const totalCapacity = tanks.reduce((acc, t) => acc + t.capacity_liters, 0);
  const totalNozzles = dispensers.reduce((acc, d) => acc + d.nozzles.length, 0);
  const loggedNozzles = (bulkForm?.items ?? []).filter((i) => i.closing_reading !== null).length;
  const totalMeterLiters = (bulkForm?.items ?? []).reduce((acc, i) => acc + (i.sales ?? 0), 0);

  const openNozzleModal = (nozzle: Nozzle, dispenserName: string) => {
    const bulkItem = bulkMap.get(nozzle.uuid);
    setSelectedNozzle({ nozzle, dispenserName, bulkItem });
    setClosingInput(
      bulkItem?.closing_reading !== null && bulkItem?.closing_reading !== undefined
        ? String(bulkItem.closing_reading)
        : ""
    );
    setTestingInput(String(bulkItem?.testing ?? 0));
    setIsRollover(Boolean(bulkItem?.is_rollover));
  };

  const openTankModal = (tank: FuelTank) => {
    setSelectedTank(tank);
    setOpeningDip(String(Math.round(tank.current_stock_liters)));
    setClosingDip(String(Math.round(tank.current_stock_liters)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interactive Forecourt & Tank Twin"
        description="Live 2D digital twin of your pump islands, nozzle meters, and underground storage tanks. Click any nozzle or tank to act."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchBulk();
                queryClient.invalidateQueries({ queryKey: ["tanks"] });
                queryClient.invalidateQueries({ queryKey: ["dispensers"] });
              }}
            >
              <RefreshCw size={14} className="mr-1.5" />
              Refresh Twin
            </Button>
            <Button size="sm" onClick={() => navigate("/dashboard/pos")}>
              <TabletSmartphone size={14} className="mr-1.5" />
              Open POS Kiosk
            </Button>
          </div>
        }
      />

      {/* Station Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Total Underground Stock
          </p>
          <p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">
            {totalStock.toLocaleString("en-IN", { maximumFractionDigits: 0 })} L
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {totalCapacity > 0
              ? `${Math.round((totalStock / totalCapacity) * 100)}% of ${totalCapacity.toLocaleString("en-IN")} L capacity`
              : "No capacity set"}
          </p>
        </div>

        <div className="bento-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Islands &amp; Nozzles
          </p>
          <p className="mt-1 text-2xl font-extrabold text-ink tabular-nums">
            {dispensers.length} <span className="text-sm font-semibold text-ink-muted">Islands</span> / {totalNozzles}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {loggedNozzles} of {totalNozzles} meters logged today
          </p>
        </div>

        <div className="bento-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Today&apos;s Meter Volume
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-500 tabular-nums">
            {totalMeterLiters.toLocaleString("en-IN", { maximumFractionDigits: 1 })} L
          </p>
          <p className="text-xs text-ink-muted mt-0.5">Across all logged nozzles</p>
        </div>

        <div className="bento-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Low-Tank Alerts
          </p>
          {(() => {
            const lowTanks = tanks.filter(
              (t) => t.capacity_liters > 0 && t.current_stock_liters / t.capacity_liters < 0.2
            );
            return (
              <>
                <p
                  className={`mt-1 text-2xl font-extrabold tabular-nums ${
                    lowTanks.length > 0 ? "text-rose-500" : "text-emerald-500"
                  }`}
                >
                  {lowTanks.length}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {lowTanks.length > 0 ? lowTanks.map((t) => t.name).join(", ") : "All tanks healthy"}
                </p>
              </>
            );
          })()}
        </div>
      </div>

      {/* Forecourt Canopy & Dispenser Islands */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <MapIcon size={16} className="text-fuel-amber" />
            Forecourt Islands &amp; Nozzles
          </h2>
          <span className="text-xs text-ink-muted">Click any nozzle to enter meter reading</span>
        </div>

        {dispensers.length === 0 ? (
          <div className="bento-card p-8 text-center space-y-3">
            <p className="text-sm text-ink-muted">No fuel dispensers configured yet.</p>
            <Button size="sm" onClick={() => navigate("/dashboard/inventory")}>
              Configure Dispensers in Inventory
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {dispensers.map((disp) => {
              const isMaint = disp.status !== "ACTIVE";
              return (
                <div
                  key={disp.uuid}
                  className="bento-card overflow-hidden flex flex-col"
                >
                  {/* Canopy Header */}
                  <div className="flex items-center justify-between border-b border-hairline bg-surface-2/80 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuel-amber/15 text-fuel-amber">
                        <Fuel size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-ink">{disp.name}</h3>
                        <p className="text-[11px] text-ink-subtle">
                          {disp.nozzles.length} nozzle{disp.nozzles.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isMaint
                          ? "bg-rose-500/15 text-rose-500"
                          : "bg-emerald-500/15 text-emerald-500"
                      }`}
                    >
                      {isMaint ? <Wrench size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-live" />}
                      {disp.status}
                    </span>
                  </div>

                  {/* Nozzle Gun Grid */}
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    {disp.nozzles.map((nozzle) => {
                      const style = FUEL_STYLE[nozzle.fuel_type] ?? FUEL_STYLE.PETROL;
                      const bulk = bulkMap.get(nozzle.uuid);
                      const isLogged = bulk?.closing_reading !== null && bulk?.closing_reading !== undefined;
                      const connectedTank = tanks.find((t) => t.id === nozzle.tank_id);

                      return (
                        <button
                          key={nozzle.uuid}
                          type="button"
                          onClick={() => openNozzleModal(nozzle, disp.name)}
                          className={`group text-left rounded-xl border border-hairline bg-surface-2/50 p-3 transition-all cursor-pointer ${style.border} hover:bg-surface-2 hover:shadow-md ${style.glow}`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-ink truncate">
                              {nozzle.name}
                            </span>
                            {isLogged ? (
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                            ) : (
                              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                            )}
                          </div>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}>
                              {style.label}
                            </span>
                            {connectedTank && (
                              <span className="text-[10px] text-ink-subtle truncate">
                                → {connectedTank.name}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 pt-2 border-t border-hairline/60 flex items-end justify-between">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                                Meter
                              </p>
                              <p className="text-xs font-mono font-bold text-ink tabular-nums">
                                {(bulk?.closing_reading ?? nozzle.last_reading).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-ink-subtle">
                                Today
                              </p>
                              <p className="text-xs font-bold text-emerald-500 tabular-nums">
                                {isLogged ? `${(bulk?.sales ?? 0).toFixed(1)} L` : "Pending"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Underground Tank Farm (Animated Cutaways) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <Droplets size={16} className="text-blue-500" />
            Underground Tank Farm
          </h2>
          <span className="text-xs text-ink-muted">Click any tank to log physical dip</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {tanks.map((tank) => {
            const pct =
              tank.capacity_liters > 0
                ? Math.min(100, Math.max(0, Math.round((tank.current_stock_liters / tank.capacity_liters) * 100)))
                : 0;
            const style = FUEL_STYLE[tank.fuel_type] ?? FUEL_STYLE.PETROL;
            const forecast = forecastMap.get(tank.uuid);
            const linkedNozzles = dispensers.flatMap((d) =>
              d.nozzles.filter((n) => n.tank_id === tank.id)
            );

            return (
              <button
                key={tank.uuid}
                type="button"
                onClick={() => openTankModal(tank)}
                className="bento-card p-5 text-left flex flex-col gap-4 cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-ink">{tank.name}</h3>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Feeds {linkedNozzles.length} nozzle{linkedNozzles.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  {forecast?.days_until_empty !== null && forecast?.days_until_empty !== undefined && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        forecast.days_until_empty <= 3
                          ? "bg-rose-500/15 text-rose-500"
                          : "bg-surface-2 text-ink-muted"
                      }`}
                    >
                      ~{forecast.days_until_empty.toFixed(1)}d left
                    </span>
                  )}
                </div>

                {/* Animated Cutaway Cylinder */}
                <div className="relative h-28 w-full overflow-hidden rounded-2xl border border-hairline bg-surface-2">
                  <div
                    className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${style.bar} opacity-80 transition-all duration-700`}
                    style={{ height: `${pct}%` }}
                  >
                    <div className="animate-wave-drift absolute -top-2 left-0 w-[130%] h-4 rounded-[100%] bg-white/25" />
                  </div>
                  <div className="relative z-10 flex h-full flex-col items-center justify-center text-center drop-shadow-sm">
                    <span className="text-2xl font-black text-ink tabular-nums">{pct}%</span>
                    <span className="text-xs font-bold text-ink/90 tabular-nums">
                      {tank.current_stock_liters.toLocaleString("en-IN", { maximumFractionDigits: 0 })} /{" "}
                      {tank.capacity_liters.toLocaleString("en-IN", { maximumFractionDigits: 0 })} L
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Gauge size={13} /> Click to log dip
                  </span>
                  <span className="font-semibold text-fuel-amber group-hover:underline inline-flex items-center gap-1">
                    <Plus size={12} /> Dip Reading
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Nozzle Meter Reading Modal */}
      <AppDialog
        open={Boolean(selectedNozzle)}
        onOpenChange={(open) => !open && setSelectedNozzle(null)}
        title={
          selectedNozzle
            ? `${selectedNozzle.dispenserName} — ${selectedNozzle.nozzle.name}`
            : "Log Meter Reading"
        }
        description="Enter today's closing meter reading directly from the forecourt twin."
      >
        {selectedNozzle && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-2 p-3 flex items-center justify-between text-xs">
              <span className="text-ink-muted">Opening Reading</span>
              <span className="font-mono font-bold text-ink">
                {(
                  selectedNozzle.bulkItem?.opening_reading ??
                  selectedNozzle.nozzle.last_reading
                ).toLocaleString("en-IN")}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label>Closing Meter Reading</Label>
              <Input
                type="number"
                step="0.01"
                value={closingInput}
                onChange={(e) => setClosingInput(e.target.value)}
                placeholder="Enter closing reading"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Testing Liters</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={testingInput}
                  onChange={(e) => setTestingInput(e.target.value)}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRollover}
                    onChange={(e) => setIsRollover(e.target.checked)}
                    className="h-4 w-4 accent-fuel-orange"
                  />
                  Meter Rollover
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/dashboard/pos?fuel=${selectedNozzle.nozzle.fuel_type}`)
                }
              >
                <TabletSmartphone size={14} className="mr-1.5" />
                Sell in POS
              </Button>
              <Button
                type="button"
                disabled={saveReadingMutation.isPending || !closingInput}
                onClick={() => saveReadingMutation.mutate()}
              >
                {saveReadingMutation.isPending ? "Saving..." : "Save Meter Reading"}
              </Button>
            </div>
          </div>
        )}
      </AppDialog>

      {/* Tank Dip Modal */}
      <AppDialog
        open={Boolean(selectedTank)}
        onOpenChange={(open) => !open && setSelectedTank(null)}
        title={selectedTank ? `Log Dip — ${selectedTank.name}` : "Log Tank Dip"}
        description="Record opening and closing physical dip volume (Liters)."
      >
        {selectedTank && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Opening Dip (L)</Label>
                <Input
                  type="number"
                  value={openingDip}
                  onChange={(e) => setOpeningDip(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Closing Dip (L)</Label>
                <Input
                  type="number"
                  value={closingDip}
                  onChange={(e) => setClosingDip(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={saveDipMutation.isPending || !closingDip}
                onClick={() => saveDipMutation.mutate()}
              >
                {saveDipMutation.isPending ? "Saving..." : "Save Dip Reading"}
              </Button>
            </div>
          </div>
        )}
      </AppDialog>
    </div>
  );
}
