import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: Props) {
  return (
    <div className="relative w-80">
      <Search
        className="absolute left-3 top-3 h-4 w-4 text-slate-400"
      />

      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-lg border py-2 pl-10 pr-4"
      />
    </div>
  );
}