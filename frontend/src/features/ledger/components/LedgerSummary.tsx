interface Props {
  customerName: string;
  openingBalance: number;
  closingBalance: number;
}

export default function LedgerSummary({
  customerName,
  openingBalance,
  closingBalance,
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Customer
        </p>
        <p className="mt-1 text-lg font-semibold">
          {customerName}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Opening (this page)
        </p>
        <p className="mt-1 text-lg font-semibold">
          ₹{openingBalance.toLocaleString()}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Closing Balance
        </p>
        <p className="mt-1 text-lg font-semibold">
          ₹{closingBalance.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
