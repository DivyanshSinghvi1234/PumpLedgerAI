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
      <p className="mb-6 text-ink-muted">
        {description}
      </p>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition cursor-pointer"
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
