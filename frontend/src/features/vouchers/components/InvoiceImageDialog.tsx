import { useState, useEffect } from "react";
import { ExternalLink, AlertCircle, Image as ImageIcon } from "lucide-react";
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl, open]);

  const handleOpenNewTab = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!imageUrl) return;
    e.preventDefault();
    window.open(imageUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-surface-1 text-ink p-6 shadow-2xl border border-hairline rounded-2xl">
        <DialogTitle className="mb-4 text-lg font-bold flex items-center justify-between">
          <span>Invoice{invoiceNumber ? ` — ${invoiceNumber}` : ""}</span>
        </DialogTitle>

        {imageUrl && !hasError ? (
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-hairline bg-canvas p-2 flex items-center justify-center">
              <img
                src={imageUrl}
                alt={`Invoice ${invoiceNumber || ""}`}
                onError={() => setHasError(true)}
                className="max-w-full h-auto object-contain rounded-lg shadow-sm"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={imageUrl}
                onClick={handleOpenNewTab}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover hover:underline cursor-pointer"
              >
                <span>Open in new tab</span>
                <ExternalLink size={14} />
              </a>

              <span className="text-xs text-ink-subtle font-mono">
                {imageUrl.split("/").pop()}
              </span>
            </div>
          </div>
        ) : hasError ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle size={40} className="text-amber-500" />
            <p className="text-sm font-semibold text-ink">
              Unable to load invoice image.
            </p>
            <p className="text-xs text-ink-muted max-w-md">
              The image file may have been moved or is stored locally on a different server instance.
            </p>
            {imageUrl && (
              <a
                href={imageUrl}
                onClick={handleOpenNewTab}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary underline"
              >
                Try opening direct link <ExternalLink size={12} />
              </a>
            )}
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
            <ImageIcon size={40} className="text-ink-subtle opacity-50" />
            <p className="text-sm text-ink-muted">
              No invoice image available for this voucher.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
