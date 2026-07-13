import AppDialog from "./AppDialog";
import LoadingButton from "./LoadingButton";

interface Props {
  open: boolean;

  title: string;

  description: string;

  loading?: boolean;

  onCancel(): void;

  onConfirm(): void;
}

export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onCancel();
        }
      }}
      title={title}
    >
      <p className="mb-6 text-slate-600">
        {description}
      </p>

      <div className="flex justify-end gap-3">

        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2"
        >
          Cancel
        </button>

        <LoadingButton
          loading={loading}
          variant="danger"
          onClick={onConfirm}
        >
          Delete
        </LoadingButton>

      </div>
    </AppDialog>
  );
}