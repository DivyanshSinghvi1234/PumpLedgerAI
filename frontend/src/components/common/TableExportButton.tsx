import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportToCsv, type CsvColumn } from "@/lib/csvExport";

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
    exportToCsv(filename, columns, rows);
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
