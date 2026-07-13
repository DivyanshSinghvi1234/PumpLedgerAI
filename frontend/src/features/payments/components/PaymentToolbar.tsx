import { useState } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  onSearch(value: string): void;
  onCreate(): void;
  canCreate?: boolean;
}

export default function PaymentToolbar({
  onSearch,
  onCreate,
  canCreate = true,
}: Props) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center justify-between gap-4">
      <input
        className="w-80 rounded-md border border-hairline bg-surface-1 px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-tertiary focus:border-fuel-amber/50 focus:ring-1 focus:ring-fuel-amber/20"
        placeholder="Search reference or customer..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onSearch(e.target.value);
        }}
      />

      {canCreate && (
        <Button onClick={onCreate} className="shine bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber hover:text-canvas text-canvas font-bold border-none shadow-md shadow-fuel-amber/20 cursor-pointer">
          + Receive Payment
        </Button>
      )}
    </div>
  );
}
