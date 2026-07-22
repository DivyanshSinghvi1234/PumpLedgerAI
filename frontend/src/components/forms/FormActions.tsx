interface Props {
  loading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  disabled?: boolean;
  onCancel?(): void;
}

export default function FormActions({
  loading = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  disabled = false,
  onCancel,
}: Props) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-3 hover:text-ink transition cursor-pointer"
        >
          {cancelLabel}
        </button>
      )}

      <button
        type="submit"
        disabled={loading || disabled}
        className="rounded-xl bg-gradient-to-r from-fuel-amber to-fuel-orange hover:from-fuel-gold hover:to-fuel-amber text-canvas px-5 py-2.5 text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-fuel-amber/25 cursor-pointer"
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}
