import api, { extractApiError } from "@/api/client";

export async function uploadInvoice(file: File) {
  const formData = new FormData();

  formData.append("file", file);

  const response = await api.post(
    "/v1/uploads",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return response.data;
}

/** Process a small batch sequentially to stay within provider rate limits. */
export async function uploadInvoices(files: File[]) {
  const results = [];

  for (const file of files) {
    results.push(await uploadInvoice(file));
  }

  return results;
}

/**
 * Human-readable message for an upload/OCR failure. Thin wrapper over the
 * shared `extractApiError` with an upload-specific fallback.
 */
export function uploadErrorMessage(err: unknown): string {
  return extractApiError(err, "Failed to process invoice.");
}
