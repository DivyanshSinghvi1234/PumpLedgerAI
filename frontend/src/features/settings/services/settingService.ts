import api from "@/api/client";

export interface SettingResponse<T = any> {
  key: string;
  value: T | null;
}

export const settingService = {
  async getSetting<T = any>(key: string): Promise<T | null> {
    const response = await api.get<SettingResponse<T>>(`/settings/${key}`);
    return response.data.value;
  },

  async saveSetting<T = any>(key: string, value: T): Promise<T> {
    const response = await api.post<SettingResponse<T>>(`/settings/${key}`, { value });
    return response.data.value!;
  },
};

export default settingService;
