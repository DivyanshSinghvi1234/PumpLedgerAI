import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

interface TableExportButtonProps<T> {
  filename: string;
  columns: CsvColumn<T>[];
  rows: T[];
  label?: string;
}

export default function TableExportButton<T>({
  filename,
  columns,
  rows,
  label = "Export CSV",
}: TableExportButtonProps<T>) {
  const handleExport = () => {
    if (rows.length === 0) {
      toast.info("No rows to export.");
      return;
    }
    const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
    const body = rows.map((r) => columns.map((c) => escapeCsvCell(c.accessor(r))).join(","));
    const blob = new Blob(["\uFEFF" + [header, ...body].join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row(s) to CSV.`);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="gap-1.5 text-xs font-semibold"
    >
      <Download size={14} />
      {label}
    </Button>
  );
}
