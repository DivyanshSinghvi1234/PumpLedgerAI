import { BookOpen, Pencil, Trash2 } from "lucide-react";

interface Props {
  onViewLedger(): void;
  onEdit(): void;
  onDelete(): void;
}

export default function CustomerActions({
  onViewLedger,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-2">

      <button
        type="button"
        onClick={onViewLedger}
        title="View ledger"
        className="rounded-md p-2 transition hover:bg-muted"
      >
        <BookOpen
          size={18}
          className="text-muted-foreground"
        />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="rounded-md p-2 transition hover:bg-accent"
      >
        <Pencil
          size={18}
          className="text-primary"
        />
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-2 transition hover:bg-red-50"
      >
        <Trash2
          size={18}
          className="text-red-600"
        />
      </button>

    </div>
  );
}