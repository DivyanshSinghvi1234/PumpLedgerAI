import { useQuery } from "@tanstack/react-query";
import bankAccountService from "@/features/admin/services/bankAccountService";
import { Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface BankAccountSelectProps {
  value: string | undefined;
  onChange: (uuid: string) => void;
  label?: string;
  className?: string;
  required?: boolean;
}

export default function BankAccountSelect({
  value,
  onChange,
  label = "Select Destination/Source Bank Account",
  className = "",
  required = false,
}: BankAccountSelectProps) {
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => bankAccountService.getBankAccounts(),
  });

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-ink-muted flex items-center gap-1.5">
          <Landmark size={14} className="text-blue-500" />
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink font-semibold outline-none focus:border-fuel-amber"
        required={required}
      >
        <option value="">-- Select Bank Account --</option>
        {isLoading ? (
          <option disabled>Loading bank accounts...</option>
        ) : !accounts || accounts.length === 0 ? (
          <option disabled>No active bank accounts found. Add one in Admin section.</option>
        ) : (
          accounts.map((acc) => (
            <option key={acc.uuid} value={acc.uuid}>
              {acc.bank_name} - {acc.account_name} (****{acc.account_number.slice(-4)}) — Bal: {formatCurrency(acc.current_balance)}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
