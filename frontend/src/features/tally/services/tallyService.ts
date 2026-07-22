import api from "@/api/client";
import type { TallyExportRequest, TallyPreviewResponse, TallyMarkSyncedRequest } from "../types";

class TallyService {
  async previewExport(data: TallyExportRequest): Promise<TallyPreviewResponse> {
    const response = await api.post<TallyPreviewResponse>("/v1/tally/preview", data);
    return response.data;
  }

  async downloadExportXml(data: TallyExportRequest): Promise<Blob> {
    const response = await api.post<Blob>("/v1/tally/export", data, {
      responseType: "blob",
    });
    return response.data;
  }

  async markAsSynced(data: TallyMarkSyncedRequest): Promise<void> {
    await api.post("/v1/tally/mark-synced", data);
  }

  async importTallyXml(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/v1/tally/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  }
}

const tallyService = new TallyService();
export default tallyService;
