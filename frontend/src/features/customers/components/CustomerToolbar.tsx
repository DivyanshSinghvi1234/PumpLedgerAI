import { useState } from "react";

interface Props {
  onSearch(value: string): void;
  onCreate(): void;
}

export default function CustomerToolbar({
  onSearch,
  onCreate,
}: Props) {
  const [value, setValue] = useState("");

  return (
    <div className="flex items-center justify-between gap-4">
      <input
        className="w-80 rounded-md border px-3 py-2"
        placeholder="Search customer..."
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onSearch(e.target.value);
        }}
      />

      <button
        onClick={onCreate}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        + New Customer
      </button>
    </div>
  );
}