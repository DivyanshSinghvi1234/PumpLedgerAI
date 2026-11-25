import { useState } from "react";
import { MessageSquare, Copy, ExternalLink } from "lucide-react";

import api from "@/api/client";
import { formatCurrency } from "@/lib/utils";

import { useDebtorAging } from "../hooks/useDebtorAging";
import reportService from "../services/reportService";

interface OverdueReminderItem {
  customer_uuid: string;
  customer_name: string;
  phone: string;
  overdue_amount: number;
  overdue_slips: number;
  max_age_days: number;
  message: string;
  whatsapp_url: string | null;
}

interface OverdueReminderResponse {
  as_of_date: string;
  min_age_days: number;
  total_customers: number;
  total_overdue_amount: number;
  items: OverdueReminderItem[];
}

export default function DebtorAgingSection() {
  const { data, isLoading, isError } = useDebtorAging();
  const [showReminders, setShowReminders] = useState(false);
  const [minAgeDays, setMinAgeDays] = useState(15);
  const [reminders, setReminders] = useState<OverdueReminderResponse | null>(null);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [copied, setCopied] = useState(false);

  function exportCsv() {
    reportService.downloadCsv(
      "/v1/reports/debtor-aging/export",
      {},
      "debtor_aging.csv"
    );
  }

  async function loadReminders(days = minAgeDays) {
    setLoadingReminders(true);
    setShowReminders(true);
    try {
      const res = await api.get<OverdueReminderResponse>(
        "/v1/customers/whatsapp-overdue-reminders",
        { params: { min_age_days: days } }
      );
      setReminders(res.data);
    } finally {
      setLoadingReminders(false);
    }
  }

  async function copyAllMessages() {
    if (!reminders?.items.length) return;
    const text = reminders.items
      .map((i) => `${i.customer_name} (${i.phone || "No phone"}): ${i.message}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Outstanding credit balances by invoice age. Oldest dues need chasing first.
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadReminders(minAgeDays)}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/40"
          >
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            Send Overdue Reminders
          </button>
          <button
            onClick={exportCsv}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Export CSV
          </button>
        </div>
      </div>

      {showReminders && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold">Overdue WhatsApp Reminder Queue</h3>
              <select
                value={minAgeDays}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  setMinAgeDays(days);
                  loadReminders(days);
                }}
                className="rounded border border-border bg-background px-2 py-1 text-xs"
              >
                <option value={15}>15+ days overdue</option>
                <option value={30}>30+ days overdue</option>
                <option value={60}>60+ days overdue</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {reminders && reminders.items.length > 0 && (
                <button
                  type="button"
                  onClick={copyAllMessages}
                  className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy All"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowReminders(false)}
                className="rounded border px-2.5 py-1 text-xs"
              >
                Close
              </button>
            </div>
          </div>

          {loadingReminders ? (
            <p className="text-xs text-muted-foreground">Building overdue reminder queue…</p>
          ) : !reminders || reminders.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No customers have slips overdue by {minAgeDays}+ days.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {reminders.items.map((item) => (
                <div
                  key={item.customer_uuid}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-xs"
                >
                  <div>
                    <span className="font-semibold">{item.customer_name}</span>{" "}
                    <span className="text-muted-foreground">
                      · {formatCurrency(item.overdue_amount)} ({item.overdue_slips} slips, oldest {item.max_age_days}d)
                    </span>
                  </div>
                  {item.whatsapp_url ? (
                    <a
                      href={item.whatsapp_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700"
                    >
                      Open WhatsApp
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No mobile</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data && (
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span>
            Debtors: <strong>{data.count}</strong>
          </span>
          <span>
            Total Outstanding:{" "}
            <strong>{formatCurrency(data.total_outstanding)}</strong>
          </span>
          <span>
            60+ days:{" "}
            <strong className="text-red-600">
              {formatCurrency(data.total_60_plus)}
            </strong>
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Mobile</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">0-15 d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">16-30 d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">31-60 d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">60+ d</th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-red-600">
                  Failed to load the debtor-aging report.
                </td>
              </tr>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No outstanding debtors.
                </td>
              </tr>
            ) : (
              data?.rows.map((r) => (
                <tr key={r.customer_uuid} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                  <td className="px-3 py-2">{r.mobile ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.bucket_0_15)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.bucket_16_30)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(r.bucket_31_60)}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-600">
                    {formatCurrency(r.bucket_60_plus)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatCurrency(r.total_outstanding)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="bg-muted/50">
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totals</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_0_15)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_16_30)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_31_60)}</td>
                <td className="px-3 py-2 text-right text-red-600">{formatCurrency(data.total_60_plus)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(data.total_outstanding)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
