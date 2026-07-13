interface Props {
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  onCancel?(): void;
}

export default function FormActions({
  loading = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  onCancel,
}: Props) {
  return (
    <div className="flex justify-end gap-3 pt-6">

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-4 py-2"
        >
          {cancelLabel}
        </button>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Saving..." : submitLabel}
      </button>

    </div>
  );
}