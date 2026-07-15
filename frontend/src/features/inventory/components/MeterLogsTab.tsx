import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import inventoryService from "../services/inventoryService";
import type { FuelType } from "../types";

export default function MeterLogsTab() {
  // Query nozzle readings history
  const { data: nozzleReadings, isLoading: readingsLoading } = useQuery({
    queryKey: ["nozzleReadingsHistory"],
    queryFn: () => inventoryService.getNozzleReadings(),
  });

  // Query dispensers list to resolve nozzle name lookups
  const { data: dispensers } = useQuery({
    queryKey: ["dispensers"],
    queryFn: () => inventoryService.getDispensers(),
  });

  // Map nozzle integer IDs to their dispenser name and custom nozzle name details
  const nozzleLookup = useMemo(() => {
    const map: Record<number, { nozzleName: string; dispenserName: string; fuel_type: FuelType }> = {};
    dispensers?.forEach((d) => {
      d.nozzles?.forEach((n) => {
        map[n.id] = { nozzleName: n.name, dispenserName: d.name, fuel_type: n.fuel_type };
      });
    });
    return map;
  }, [dispensers]);

  // Group nozzle readings date-wise chronologically
  const groupedReadings = useMemo(() => {
    if (!nozzleReadings) return [];

    const map: Record<string, typeof nozzleReadings> = {};
    nozzleReadings.forEach((reading) => {
      const dateStr = reading.reading_date.split("T")[0];
      if (!map[dateStr]) {
        map[dateStr] = [];
      }
      map[dateStr].push(reading);
    });

    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const items = map[date];
        const totalSales = items.reduce((acc, curr) => acc + curr.sales, 0);
        return { date, items, totalSales };
      });
  }, [nozzleReadings]);

  return (
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
                            fuel_type: "PETROL" as FuelType,
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
                              <TableCell className="text-xs text-ink-muted font-mono">
                                {reading.opening_reading.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                              </TableCell>
                              <TableCell className="text-xs text-ink-muted font-mono">
                                {reading.closing_reading.toLocaleString(undefined, { minimumFractionDigits: 2 })} L
                              </TableCell>
                              <TableCell className="px-5 text-right font-bold text-xs text-ink font-mono">
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
  );
}
