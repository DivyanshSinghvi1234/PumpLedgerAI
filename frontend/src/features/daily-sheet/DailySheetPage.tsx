import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlusCircle,
  FolderOpen,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import LoadingState from "@/components/common/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import dailySheetService from "@/features/daily-sheet/services/dailySheetService";
import SheetDetail from "./components/SheetDetail";
import SheetPreview from "./components/SheetPreview";
import StoredSheetsList from "./components/StoredSheetsList";

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DailySheetPage() {
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState<"last" | "create" | "stored">("last");

  // Create tab configuration state
  const today = new Date().toISOString().split("T")[0];
  const [createDate, setCreateDate] = useState(today);
  const [useCustomWindow, setUseCustomWindow] = useState(false);

  // Time window configurations (stored in localStorage)
  const [defaultStartHour, setDefaultStartHour] = useState(
    () => localStorage.getItem("daily_sheet_default_start_hour") || "12:00"
  );
  const [defaultEndHour, setDefaultEndHour] = useState(
    () => localStorage.getItem("daily_sheet_default_end_hour") || "12:00"
  );
  const [defaultStartOffset, setDefaultStartOffset] = useState(
    () => Number(localStorage.getItem("daily_sheet_default_start_offset") ?? "-1")
  );
  const [defaultEndOffset, setDefaultEndOffset] = useState(
    () => Number(localStorage.getItem("daily_sheet_default_end_offset") ?? "0")
  );
  const [showSettings, setShowSettings] = useState(false);

  // Calculate datetime bounds from offsets
  const calculateDefaultPeriod = (
    baseDateStr: string,
    startHr: string,
    startOff: number,
    endHr: string,
    endOff: number
  ) => {
    try {
      const [year, month, day] = baseDateStr.split("-").map(Number);
      
      const startDate = new Date(year, month - 1, day);
      startDate.setDate(startDate.getDate() + startOff);
      const [startH, startM] = startHr.split(":").map(Number);
      startDate.setHours(startH, startM, 0, 0);

      const endDate = new Date(year, month - 1, day);
      endDate.setDate(endDate.getDate() + endOff);
      const [endH, endM] = endHr.split(":").map(Number);
      endDate.setHours(endH, endM, 0, 0);

      return {
        start: toDatetimeLocal(startDate),
        end: toDatetimeLocal(endDate),
      };
    } catch (e) {
      return {
        start: baseDateStr + "T12:00",
        end: baseDateStr + "T12:00",
      };
    }
  };

  const defaultStart = (): string => {
    return calculateDefaultPeriod(
      createDate,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    ).start;
  };

  const defaultEnd = (): string => {
    return calculateDefaultPeriod(
      createDate,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    ).end;
  };

  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);

  const handleCreateDateChange = (val: string) => {
    setCreateDate(val);
    const p = calculateDefaultPeriod(
      val,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    );
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
  };

  // Queries
  const { data: existingSheet } = useQuery({
    queryKey: ["dailySheet", createDate],
    queryFn: () => dailySheetService.getDailySheet(createDate),
    retry: false,
  });

  const sheetAlreadyExists = Boolean(existingSheet);

  const { data: allSheets, isLoading: sheetsLoading } = useQuery({
    queryKey: ["dailySheets"],
    queryFn: () => dailySheetService.listDailySheets(),
  });

  // Save Settings Handlers
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("daily_sheet_default_start_hour", defaultStartHour);
    localStorage.setItem("daily_sheet_default_end_hour", defaultEndHour);
    localStorage.setItem("daily_sheet_default_start_offset", String(defaultStartOffset));
    localStorage.setItem("daily_sheet_default_end_offset", String(defaultEndOffset));
    
    // Refresh dates with new config
    const p = calculateDefaultPeriod(
      createDate,
      defaultStartHour,
      defaultStartOffset,
      defaultEndHour,
      defaultEndOffset
    );
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
    setShowSettings(false);
    toast.success("Timing configuration updated successfully!");
  };

  // Create Daily Sheet Mutation
  const [createError, setCreateError] = useState<string | null>(null);

  const generateSheetMutation = useMutation({
    mutationFn: () =>
      dailySheetService.createDailySheet(createDate, {
        period_start: new Date(periodStart).toISOString(),
        period_end: new Date(periodEnd).toISOString(),
      }),
    onSuccess: () => {
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: ["dailySheets"] });
      queryClient.invalidateQueries({ queryKey: ["dailySheet", createDate] });
      toast.success("Daily sheet generated and saved successfully!");
      setActiveTab("last");
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 409) {
        setCreateError(`A daily sheet for ${new Date(createDate).toLocaleDateString("en-IN", { dateStyle: "long" })} already exists.`);
      } else {
        setCreateError(err?.response?.data?.detail ?? "Failed to generate sheet.");
      }
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Sheet"
        description="Generate time-bound accounting snapshots and access all stored sheets."
      />

      <div>
        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-surface-2 border border-hairline rounded-lg p-1 w-fit no-print">
          <button
            type="button"
            onClick={() => setActiveTab("last")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
              activeTab === "last"
                ? "bg-fuel-amber text-canvas shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-surface-3"
            }`}
          >
            <ClipboardList size={13} /> Last Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
              activeTab === "create"
                ? "bg-fuel-amber text-canvas shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-surface-3"
            }`}
          >
            <PlusCircle size={13} /> Create Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("stored")}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md transition-colors cursor-pointer ${
              activeTab === "stored"
                ? "bg-fuel-amber text-canvas shadow-sm"
                : "text-ink-muted hover:text-ink hover:bg-surface-3"
            }`}
          >
            <FolderOpen size={13} /> Stored Sheets
            {allSheets && allSheets.length > 0 && (
              <Badge className="ml-1 text-[8px] px-1.5 py-0 bg-ink/10 text-ink border-transparent font-bold">
                {allSheets.length}
              </Badge>
            )}
          </button>
        </div>

        {/* TAB 1 — LAST SHEET */}
        {activeTab === "last" && (
          <div className="mt-6">
            {sheetsLoading ? (
              <LoadingState />
            ) : allSheets && allSheets.length > 0 ? (
              <SheetDetail
                key={allSheets[0].uuid}
                sheet={allSheets[0]}
                onClose={() => {}}
                hideBackButton={true}
              />
            ) : (
              <Card className="glass border-hairline py-16 flex flex-col items-center text-center max-w-xl mx-auto">
                <ClipboardList size={40} className="text-ink-subtle mb-4" />
                <h3 className="text-base font-bold text-ink mb-2">No Sheets Generated Yet</h3>
                <p className="text-sm text-ink-muted max-w-prose mb-6 leading-relaxed">
                  You haven't generated any daily snapshots yet. Go to the <strong>Create Sheet</strong> tab to generate your first snapshot.
                </p>
                <Button
                  onClick={() => setActiveTab("create")}
                  className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold text-sm h-8 cursor-pointer"
                >
                  Create First Sheet
                </Button>
              </Card>
            )}
          </div>
        )}

        {/* TAB 2 — CREATE SHEET */}
        {activeTab === "create" && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="glass border-hairline md:col-span-2 h-fit">
                <CardContent className="p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="createDateInput" className="text-xs font-bold text-ink-muted">Select Date</Label>
                      <Input
                        id="createDateInput"
                        type="date"
                        value={createDate}
                        onChange={(e) => handleCreateDateChange(e.target.value)}
                        className="bg-surface-2 border-hairline text-sm w-full sm:w-48 text-ink h-10 px-3.5 rounded-lg"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-4 sm:pt-0">
                      <input
                        id="customWindowToggle"
                        type="checkbox"
                        checked={useCustomWindow}
                        onChange={(e) => setUseCustomWindow(e.target.checked)}
                        className="rounded accent-fuel-amber h-4 w-4 cursor-pointer"
                      />
                      <Label htmlFor="customWindowToggle" className="text-sm text-ink font-semibold cursor-pointer">
                        Specify custom start/end times
                      </Label>
                    </div>
                  </div>

                  {useCustomWindow && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-hairline pt-4 animate-fade-in">
                      <div className="space-y-2">
                        <Label htmlFor="periodStart" className="text-xs font-bold text-ink-muted">Period Start</Label>
                        <Input
                          id="periodStart"
                          type="datetime-local"
                          value={periodStart}
                          onChange={(e) => setPeriodStart(e.target.value)}
                          className="bg-surface-2 border-hairline text-sm text-ink h-10 px-3.5 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="periodEnd" className="text-xs font-bold text-ink-muted">Period End</Label>
                        <Input
                          id="periodEnd"
                          type="datetime-local"
                          value={periodEnd}
                          onChange={(e) => setPeriodEnd(e.target.value)}
                          className="bg-surface-2 border-hairline text-sm text-ink h-10 px-3.5 rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {/* Settings section */}
                  {showSettings ? (
                    <form onSubmit={handleSaveSettings} className="border-t border-hairline pt-4 space-y-4 animate-fade-in">
                      <h4 className="text-xs font-bold text-ink-muted uppercase tracking-wider font-mono">Configure Default Shift Window</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-2">
                          <Label className="text-[10px] text-ink-subtle">Start Time</Label>
                          <Input
                            type="text"
                            value={defaultStartHour}
                            onChange={(e) => setDefaultStartHour(e.target.value)}
                            className="bg-surface-2 border-hairline text-sm h-10 px-3 rounded-lg text-ink"
                            placeholder="12:00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] text-ink-subtle">Start Day Offset</Label>
                          <select
                            value={defaultStartOffset}
                            onChange={(e) => setDefaultStartOffset(Number(e.target.value))}
                            className="w-full bg-surface-2 border border-hairline rounded-lg outline-none text-sm text-ink px-3 h-10 transition-colors focus:border-fuel-amber"
                          >
                            <option value={-1}>Yesterday (-1)</option>
                            <option value={0}>Same Day (0)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] text-ink-subtle">End Time</Label>
                          <Input
                            type="text"
                            value={defaultEndHour}
                            onChange={(e) => setDefaultEndHour(e.target.value)}
                            className="bg-surface-2 border-hairline text-sm h-10 px-3 rounded-lg text-ink"
                            placeholder="12:00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] text-ink-subtle">End Day Offset</Label>
                          <select
                            value={defaultEndOffset}
                            onChange={(e) => setDefaultEndOffset(Number(e.target.value))}
                            className="w-full bg-surface-2 border border-hairline rounded-lg outline-none text-sm text-ink px-3 h-10 transition-colors focus:border-fuel-amber"
                          >
                            <option value={0}>Same Day (0)</option>
                            <option value={1}>Tomorrow (+1)</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowSettings(false)}
                          className="h-9 px-4 text-xs text-ink-subtle"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-fuel-amber hover:bg-fuel-amber/90 text-canvas font-bold h-9 px-4 text-xs rounded-lg"
                        >
                          Apply Defaults
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between border-t border-hairline pt-3 text-[11px] text-ink-subtle">
                      <p>
                        Current settings:{" "}
                        <span className="font-mono text-ink">
                          {defaultStartOffset === -1 ? "Yesterday" : "Same day"} {defaultStartHour}
                        </span>{" "}
                        to{" "}
                        <span className="font-mono text-ink">
                          {defaultEndOffset === 1 ? "Tomorrow" : "Same day"} {defaultEndHour}
                        </span>
                      </p>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="text-fuel-amber hover:underline font-semibold cursor-pointer"
                      >
                        Change settings
                      </button>
                    </div>
                  )}

                  {createError && !sheetAlreadyExists && (
                    <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                      <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-red-600">{createError}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-hairline bg-surface-2/40 md:col-span-1">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-bold text-ink-muted uppercase tracking-wider font-mono">How it works</p>
                  <ul className="text-xs text-ink-muted space-y-1.5 list-none">
                    <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">①</span> Select the accounting date and optional custom time window.</li>
                    <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">②</span> Review the <strong>Live Sheet Preview</strong> generated below.</li>
                    <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">③</span> If satisfied, click <strong>Generate & Save Daily Sheet</strong> in the preview banner.</li>
                    <li className="flex items-start gap-2"><span className="text-fuel-amber mt-0.5">④</span> Stored sheets are persisted and can be viewed or updated in the Stored Sheets tab.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <SheetPreview
              createDate={createDate}
              periodStart={periodStart}
              periodEnd={periodEnd}
              sheetAlreadyExists={sheetAlreadyExists}
              onGenerate={() => { setCreateError(null); generateSheetMutation.mutate(); }}
              isGenerating={generateSheetMutation.isPending}
              createError={createError}
            />
          </div>
        )}

        {/* TAB 3 — STORED SHEETS */}
        {activeTab === "stored" && (
          <div className="mt-6">
            <StoredSheetsList
              allSheets={allSheets}
              sheetsLoading={sheetsLoading}
              onGoToCreate={() => setActiveTab("create")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
