import { useState } from "react";
import { FolderOpen, PlusCircle, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import LoadingState from "@/components/common/LoadingState";
import SheetDetail from "./SheetDetail";
import type { DailySheet } from "../services/dailySheetService";

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface StoredSheetsListProps {
  allSheets: DailySheet[] | undefined;
  sheetsLoading: boolean;
  onGoToCreate: () => void;
}

export default function StoredSheetsList({ allSheets, sheetsLoading, onGoToCreate }: StoredSheetsListProps) {
  const [selectedSheet, setSelectedSheet] = useState<DailySheet | null>(null);

  if (selectedSheet) {
    return (
      <SheetDetail
        key={selectedSheet.uuid}
        sheet={selectedSheet}
        onClose={() => setSelectedSheet(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sheetsLoading ? (
        <LoadingState />
      ) : !allSheets || allSheets.length === 0 ? (
        <Card className="glass border-hairline py-16 flex flex-col items-center text-center max-w-xl mx-auto">
          <FolderOpen size={40} className="text-ink-subtle mb-4" />
          <h3 className="text-base font-bold text-ink mb-2">No Sheets Generated Yet</h3>
          <p className="text-sm text-ink-muted max-w-prose mb-6 leading-relaxed">
            Go to the <strong>Create Sheet</strong> tab to generate your first daily sheet.
          </p>
          <Button
            onClick={onGoToCreate}
            className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-sm h-8 cursor-pointer"
          >
            <PlusCircle size={14} className="mr-1.5" /> Create First Sheet
          </Button>
        </Card>
      ) : (
        <>
          <p className="text-xs text-ink-muted px-1">
            {allSheets.length} sheet{allSheets.length !== 1 ? "s" : ""} · Click any row to view details
          </p>
          <Card className="glass border-hairline overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-hairline hover:bg-transparent">
                  <TableHead className="px-4 py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Date</TableHead>
                  <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Period Start</TableHead>
                  <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Period End</TableHead>
                  <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Remarks</TableHead>
                  <TableHead className="py-2.5 text-[9px] font-mono uppercase tracking-wider text-ink-subtle">Scan</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSheets.map((sheet) => (
                  <TableRow
                    key={sheet.uuid}
                    className="border-b border-hairline hover:bg-surface-3/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedSheet(sheet)}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="font-bold text-sm text-ink">
                        {new Date(sheet.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-[9px] text-ink-subtle font-mono mt-0.5">
                        Generated: {fmtDt(sheet.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-ink-muted font-mono whitespace-nowrap">
                      {fmtDt(sheet.period_start)}
                    </TableCell>
                    <TableCell className="py-3 text-xs text-fuel-amber font-mono font-semibold whitespace-nowrap">
                      {fmtDt(sheet.period_end)}
                    </TableCell>
                    <TableCell className="py-3 max-w-[160px]">
                      {sheet.remarks ? (
                        <span className="text-xs text-ink truncate block">{sheet.remarks}</span>
                      ) : (
                        <span className="text-xs text-ink-subtle italic">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {sheet.manual_sheet_image ? (
                        <Badge className="text-[8px] px-1.5 py-0 bg-green-500/10 text-green-600 border-transparent font-bold">Uploaded</Badge>
                      ) : (
                        <span className="text-[10px] text-ink-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right">
                      <ChevronRight size={14} className="text-ink-subtle" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
