/**
 * Build a browser URL for a voucher's stored invoice image.
 *
 * The backend stores `image_path` as a filesystem path like
 * `storage\invoices\abc.jpg` (Windows) or `storage/invoices/abc.jpg`, and
 * serves the `storage/` directory at `/storage`. We normalize slashes,
 * ensure the path is rooted at `/storage`, and prefix the API origin.
 */
const API_ORIGIN = "http://127.0.0.1:8000";

export function invoiceImageUrl(
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;

  // Normalize Windows backslashes and strip any leading ./ or /
  let p = imagePath.replace(/\\/g, "/").replace(/^\.?\//, "");

  // Ensure it starts at the "storage" segment served by the mount.
  const idx = p.indexOf("storage/");
  if (idx >= 0) {
    p = p.slice(idx);
  }

  return `${API_ORIGIN}/${p}`;
}
