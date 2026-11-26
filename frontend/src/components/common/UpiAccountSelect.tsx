import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import bankAccountService, { type UpiAccount } from "@/features/admin/services/bankAccountService";
import { Smartphone } from "lucide-react";

interface UpiAccountSelectProps {
  value: string | undefined;
  onChange: (upiUuid: string, linkedBankUuid: string, account?: UpiAccount) => void;
  label?: string;
  className?: string;
  autoSelectDefault?: boolean;
}

export default function UpiAccountSelect({
  value,
  onChange,
  label = "UPI Account / Provider (PhonePe, Paytm, GPay)",
  className = "",
  autoSelectDefault = true,
}: UpiAccountSelectProps) {
  const { data: upiAccounts, isLoading } = useQuery({
    queryKey: ["upi-accounts"],
    queryFn: () => bankAccountService.getUpiAccounts(),
  });

  useEffect(() => {
    if (autoSelectDefault && !value && upiAccounts && upiAccounts.length > 0) {
      const first = upiAccounts[0];
      onChange(first.uuid, first.bank_account_uuid || "", first);
    }
  }, [autoSelectDefault, value, upiAccounts]);

  if (!isLoading && (!upiAccounts || upiAccounts.length === 0)) {
    return null;
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-ink-muted flex items-center gap-1.5">
          <Smartphone size={14} className="text-emerald-400" />
          {label}
        </label>
      )}
      <select
        value={value || ""}
        onChange={(e) => {
          const selectedUuid = e.target.value;
          const matched = upiAccounts?.find((u) => u.uuid === selectedUuid);
          onChange(selectedUuid, matched?.bank_account_uuid || "", matched);
        }}
        className="w-full bg-surface-2 border border-hairline rounded-md px-3 py-2 text-xs text-ink font-semibold outline-none focus:border-fuel-amber"
      >
        <option value="">-- Select UPI Handle (Auto-links Bank) --</option>
        {isLoading ? (
          <option disabled>Loading UPI accounts...</option>
        ) : (
          upiAccounts?.map((u) => (
            <option key={u.uuid} value={u.uuid}>
              {u.name} ({u.provider}) → {u.bank_name} - {u.bank_account_name}
              {u.upi_id ? ` [${u.upi_id}]` : ""}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
