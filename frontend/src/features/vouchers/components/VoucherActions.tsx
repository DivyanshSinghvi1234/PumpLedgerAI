import { Button } from "@/components/ui/button";

interface Props {
  voucherId: string;

  canManage?: boolean;

  onEdit(id: string): void;
  onDelete(id: string): void;
}

export default function VoucherActions({
  voucherId,
  canManage = true,
  onEdit,
  onDelete,
}: Props) {
  if (!canManage) {
    return null;
  }

  return (
    <div className="flex gap-2">

      <Button
        size="sm"
        variant="outline"
        onClick={() => onEdit(voucherId)}
      >
        Edit
      </Button>

      <Button
        size="sm"
        variant="destructive"
        onClick={() => onDelete(voucherId)}
      >
        Delete
      </Button>

    </div>
  );
}