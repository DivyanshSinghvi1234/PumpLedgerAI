import { useQuery } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import bankAccountService from "@/features/admin/services/bankAccountService";
import { formatCurrency } from "@/lib/utils";

interface UpiCollectionBreakdownProps {
  date: string;
}

export default function UpiCollectionBreakdown({ date }: UpiCollectionBreakdownProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["upi-collection-summary", date],
    queryFn: () => bankAccountService.getUpiCollectionSummary(date),
    enabled: Boolean(date),
  });

  if (isLoading || !data || data.items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-2 p-4 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold uppercase text-ink-muted flex items-center gap-1.5">
          <Smartphone size={14} className="text-emerald-400" />
          UPI Handle-Wise Collections
        </p>
        <span className="font-mono font-bold text-emerald-400">
          {formatCurrency(data.total_upi)}
        </span>
      </div>
      <div className="space-y-1.5 pt-1 border-t border-hairline/60">
        {data.items.map((item) => (
          <div key={item.upi_uuid} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-semibold text-ink">{item.name}</span>
              <span className="ml-1.5 text-[10px] font-mono text-ink-subtle">
                [{item.provider}]
                {item.bank_name ? ` → ${item.bank_name}` : ""}
              </span>
              <span className="ml-1.5 text-[10px] text-ink-subtle">
                ({item.txn_count} txns)
              </span>
            </div>
            <span className="font-mono font-semibold text-ink shrink-0">
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
