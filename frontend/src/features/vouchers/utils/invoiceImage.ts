/**
 * Build a browser URL for a voucher's stored invoice image.
 *
 * The backend stores `image_path` as a filesystem path like
 * `storage\invoices\abc.jpg` (Windows) or `storage/invoices/abc.jpg`, and
 * serves the `storage/` directory at `/storage`. We normalize slashes,
 * ensure the path is rooted at `/storage`, and prefix the API origin.
 */
export function invoiceImageUrl(
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;

  // R2 (or any remote storage) returns an absolute URL — use it verbatim.
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  // Normalize Windows backslashes and strip any leading ./ or /
  let p = imagePath.replace(/\\/g, "/").replace(/^\.?\//, "");

  // Ensure it starts at the "storage" segment served by the backend mount.
  const idx = p.indexOf("storage/");
  if (idx >= 0) {
    p = p.slice(idx);
  } else if (p.startsWith("invoices/")) {
    p = `storage/${p}`;
  } else if (!p.startsWith("storage/")) {
    p = `storage/invoices/${p}`;
  }

  // VITE_API_BASE_URL typically ends with /api/v1. Strip it to get origin server root,
  // because static storage is mounted at /storage at the root of the API server.
  const rawBase = import.meta.env.VITE_API_BASE_URL || "";
  const baseUrl = rawBase.replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");

  return baseUrl ? `${baseUrl}/${p}` : `/${p}`;
}
