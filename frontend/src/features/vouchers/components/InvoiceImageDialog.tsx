import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  imageUrl: string | null;
  invoiceNumber?: string;
}

export default function InvoiceImageDialog({
  open,
  onOpenChange,
  imageUrl,
  invoiceNumber,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card p-6 shadow-xl">
        <DialogTitle className="mb-4 text-lg font-semibold">
          Invoice{invoiceNumber ? ` — ${invoiceNumber}` : ""}
        </DialogTitle>

        {imageUrl ? (
          <div className="space-y-3">
            <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted">
              <img
                src={imageUrl}
                alt="Invoice"
                className="mx-auto block max-w-full"
              />
            </div>

            <a
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              Open in new tab ↗
            </a>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No invoice image available for this voucher.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
