import type { LedgerEntry } from "../types/ledger";

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

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border p-12 text-center text-muted-foreground">
        No ledger entries yet.
      </div>
    );
  }

  return (
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
                  {entry.entry_date}
                </td>

                <td className="px-4 py-3">
                  {TYPE_LABELS[entry.entry_type] ??
                    entry.entry_type}
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
  );
}
