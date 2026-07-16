import { useState } from "react";
import { ImageIcon } from "lucide-react";
import type { LedgerEntry } from "../types/ledger";
import InvoiceImageDialog from "@/features/vouchers/components/InvoiceImageDialog";
import { invoiceImageUrl } from "@/features/vouchers/utils/invoiceImage";

interface Props {
  entries: LedgerEntry[];
}

const TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  VOUCHER: "Voucher",
  PAYMENT: "Payment",
  DEBIT_ADJUSTMENT: "Debit Adjustment",
  CREDIT_ADJUSTMENT: "Credit Adjustment",
};

export default function LedgerTable({
  entries,
}: Props) {
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        No ledger entries yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Date
              </th>

              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Type
              </th>

              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </th>

              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Remarks
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Debit
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Credit
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Balance
              </th>
            </tr>
          </thead>

          <tbody>
            {entries.map((entry) => {
              // signed_amount > 0 is a debit (increases dues),
              // < 0 is a credit (reduces dues).
              const isDebit = entry.signed_amount >= 0;
              const magnitude = Math.abs(
                entry.amount
              ).toLocaleString();

              return (
                <tr
                  key={entry.uuid}
                  className="border-t border-border"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{entry.entry_date}</span>
                      {entry.image_path && (
                        <button
                          type="button"
                          title="View invoice image"
                          onClick={() => setSelectedEntry(entry)}
                          className="text-ink-subtle hover:text-fuel-amber transition cursor-pointer"
                        >
                          <ImageIcon size={14} />
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span>
                        {TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
                      </span>
                      {entry.is_amount_mismatch && (
                        <span className="text-[10px] text-amber-500 font-semibold uppercase tracking-wider mt-0.5" title="Quantity * Rate does not match Total Amount">
                          ⚠️ Mismatch
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {entry.status === "Completed" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                        Completed
                      </span>
                    )}
                    {entry.status === "Pending" && (
                      <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500 ring-1 ring-inset ring-yellow-500/10">
                        Pending
                      </span>
                    )}
                    {!entry.status && "-"}
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.remarks ?? "-"}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {isDebit ? `₹${magnitude}` : "-"}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {!isDebit ? `₹${magnitude}` : "-"}
                  </td>

                  <td className="px-4 py-3 text-right font-medium">
                    ₹
                    {entry.balance_after.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InvoiceImageDialog
        open={Boolean(selectedEntry)}
        onOpenChange={(o) => !o && setSelectedEntry(null)}
        imageUrl={invoiceImageUrl(selectedEntry?.image_path)}
        invoiceNumber={selectedEntry?.invoice_number ?? undefined}
      />
    </>
  );
}
