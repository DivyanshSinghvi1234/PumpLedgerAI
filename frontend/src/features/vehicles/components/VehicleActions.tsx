import { Pencil, Trash2 } from "lucide-react";

interface Props {
  onEdit(): void;
  onDelete(): void;
}

export default function VehicleActions({
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center justify-center gap-2">

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
