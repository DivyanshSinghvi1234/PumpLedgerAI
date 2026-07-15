import api from "@/api/client";

export interface DailySheet {
  id: number;
  uuid: string;
  date: string;
  manual_sheet_image: string | null;
  remarks: string | null;
  /** ISO 8601 datetime — start of the sheet's accounting window (null on old sheets). */
  period_start: string | null;
  /** ISO 8601 datetime — end of the sheet's accounting window = time of generation (null on old sheets). */
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export const dailySheetService = {
  async getDailySheet(date: string): Promise<DailySheet | null> {
    try {
      const response = await api.get<DailySheet>(`/v1/daily-sheets/${date}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async listDailySheets(): Promise<DailySheet[]> {
    const response = await api.get<DailySheet[]>("/v1/daily-sheets");
    return response.data;
  },

  async createDailySheet(
    date: string,
    options?: {
      remarks?: string;
      period_start?: string; // ISO 8601
      period_end?: string;   // ISO 8601
    }
  ): Promise<DailySheet> {
    const response = await api.post<DailySheet>("/v1/daily-sheets", {
      date,
      remarks: options?.remarks,
      period_start: options?.period_start ?? null,
      period_end: options?.period_end ?? null,
    });
    return response.data;
  },

  async updateDailySheet(
    uuid: string,
    options: {
      remarks?: string;
      manual_sheet_image?: string;
      date?: string;
      period_start?: string; // ISO 8601
      period_end?: string;   // ISO 8601
    }
  ): Promise<DailySheet> {
    const response = await api.put<DailySheet>(`/v1/daily-sheets/${uuid}`, {
      remarks: options.remarks,
      manual_sheet_image: options.manual_sheet_image,
      date: options.date,
      period_start: options.period_start,
      period_end: options.period_end,
    });
    return response.data;
  },

  async uploadManualSheet(uuid: string, file: File): Promise<DailySheet> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<DailySheet>(
      `/v1/daily-sheets/${uuid}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  getBaseUrl(): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
    return baseUrl ? `${baseUrl}/storage/` : "/storage/";
  },
};

export default dailySheetService;
