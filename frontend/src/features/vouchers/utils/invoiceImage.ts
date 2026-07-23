/**
 * Build an absolute browser URL for a voucher's stored invoice image.
 *
 * The backend stores `image_path` as a filesystem path like
 * `storage\invoices\abc.jpg` or `storage/invoices/abc.jpg`, and
 * serves the `storage/` directory at `/storage`. We normalize slashes,
 * ensure the path is rooted at `/storage`, and prefix the full origin.
 */
function getViteApiBaseUrl(): string {
  try {
    // @ts-ignore
    if (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE_URL) {
      // @ts-ignore
      return import.meta.env.VITE_API_BASE_URL;
    }
  } catch {
    // ignore
  }
  return "";
}

export function invoiceImageUrl(
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;

  // R2 (or any remote storage) returns an absolute URL — use it verbatim.
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  // Blob URLs (e.g. local preview before upload) — return verbatim.
  if (imagePath.startsWith("blob:") || imagePath.startsWith("data:")) return imagePath;

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
  const rawBase = getViteApiBaseUrl();
  const baseUrl = rawBase.replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");

  const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return origin ? `${origin}/${p.replace(/^\//, "")}` : `/${p.replace(/^\//, "")}`;
}
