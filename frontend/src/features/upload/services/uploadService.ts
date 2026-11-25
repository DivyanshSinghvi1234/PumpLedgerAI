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

export interface BatchUploadItemResult {
  filename: string;
  status: "ok" | "error";
  review?: Record<string, unknown>;
  error?: string;
}

export interface BatchUploadResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchUploadItemResult[];
}

/** Upload and extract up to 30 slips via the backend batch endpoint. */
export async function uploadInvoices(files: File[]) {
  if (files.length === 1) {
    return [await uploadInvoice(files[0])];
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await api.post<BatchUploadResponse>(
    "/v1/uploads/batch",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  const succeeded = response.data.results
    .filter((item) => item.status === "ok" && item.review)
    .map((item) => ({
      ...item.review,
      _batchFilename: item.filename,
    }));

  if (succeeded.length === 0) {
    const firstError = response.data.results.find((r) => r.error)?.error;
    throw new Error(firstError || "All slips in the batch failed OCR extraction.");
  }

  return succeeded;
}

/**
 * Human-readable message for an upload/OCR failure. Thin wrapper over the
 * shared `extractApiError` with an upload-specific fallback.
 */
export function uploadErrorMessage(err: unknown): string {
  return extractApiError(err, "Failed to process invoice.");
}
