import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import api from "@/api/client";
import { formatCurrency, getTodayDateString } from "@/lib/utils";

interface EmployeeOption {
  uuid: string;
  full_name: string;
}

interface HandoverItem {
  uuid: string;
  handover_date: string;
  outgoing_employee_name: string;
  incoming_employee_name: string | null;
  cash_expected: number;
  cash_handed_over: number;
  variance: number;
  incoming_confirmed: boolean;
  shortage_posted: boolean;
  notes: string | null;
}

export default function ShiftHandoverPanel({ employees }: { employees: EmployeeOption[] }) {
  const queryClient = useQueryClient();
  const [outgoingUuid, setOutgoingUuid] = useState("");
  const [incomingUuid, setIncomingUuid] = useState("");
  const [cashExpected, setCashExpected] = useState("");
  const [cashHanded, setCashHanded] = useState("");
  const [notes, setNotes] = useState("");

  const { data: handovers = [] } = useQuery({
    queryKey: ["shift-handovers"],
    queryFn: async () => {
      const res = await api.get<HandoverItem[]>("/v1/shifts/handovers");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<HandoverItem>("/v1/shifts/handovers", {
        handover_date: getTodayDateString(),
        outgoing_employee_uuid: outgoingUuid,
        incoming_employee_uuid: incomingUuid || null,
        cash_expected: Number(cashExpected) || 0,
        cash_handed_over: Number(cashHanded) || 0,
        notes: notes.trim() || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Shift handover logged — awaiting incoming attendant confirmation");
      setCashExpected("");
      setCashHanded("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["shift-handovers"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to log handover"),
  });

  const confirmMutation = useMutation({
    mutationFn: async (uuid: string) => {
      const res = await api.post<HandoverItem>(`/v1/shifts/handovers/${uuid}/confirm`, {
        auto_post_shortage: true,
      });
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(
        res.shortage_posted
          ? "Handover confirmed & cash shortage posted to outgoing staff ledger"
          : "Shift handover confirmed"
      );
      queryClient.invalidateQueries({ queryKey: ["shift-handovers"] });
      queryClient.invalidateQueries({ queryKey: ["staff-payroll"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || "Failed to confirm handover"),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" />
        <div>
          <h3 className="text-sm font-semibold">Digital Shift Handover Sign-Off</h3>
          <p className="text-xs text-muted-foreground">
            Lock nozzle meter snapshot & cash float between outgoing and incoming attendants. Verified shortages auto-post to staff ledger.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Outgoing Attendant *</label>
          <select
            value={outgoingUuid}
            onChange={(e) => setOutgoingUuid(e.target.value)}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.uuid} value={e.uuid}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Incoming Attendant</label>
          <select
            value={incomingUuid}
            onChange={(e) => setIncomingUuid(e.target.value)}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            <option value="">Optional…</option>
            {employees.map((e) => (
              <option key={e.uuid} value={e.uuid}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Expected Float (₹)</label>
          <input
            type="number"
            min="0"
            value={cashExpected}
            onChange={(e) => setCashExpected(e.target.value)}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Cash Handed Over (₹)</label>
          <input
            type="number"
            min="0"
            value={cashHanded}
            onChange={(e) => setCashHanded(e.target.value)}
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <button
          type="button"
          disabled={!outgoingUuid || !cashHanded || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
        >
          Log Handover
        </button>
      </div>

      {handovers.length > 0 && (
        <div className="overflow-x-auto border-t pt-3">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50 uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Outgoing → Incoming</th>
                <th className="px-3 py-2 text-right">Expected</th>
                <th className="px-3 py-2 text-right">Handed Over</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-right">Sign-Off</th>
              </tr>
            </thead>
            <tbody>
              {handovers.slice(0, 10).map((h) => (
                <tr key={h.uuid} className="border-t border-border">
                  <td className="px-3 py-2">{h.handover_date}</td>
                  <td className="px-3 py-2 font-medium">
                    {h.outgoing_employee_name} → {h.incoming_employee_name || "Next Shift"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(h.cash_expected)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(h.cash_handed_over)}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-semibold ${
                      h.variance < 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {formatCurrency(h.variance)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {h.incoming_confirmed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirmed{h.shortage_posted ? " (Shortage Posted)" : ""}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={confirmMutation.isPending}
                        onClick={() => confirmMutation.mutate(h.uuid)}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-white font-semibold hover:bg-emerald-700 cursor-pointer"
                      >
                        Confirm Receipt
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
