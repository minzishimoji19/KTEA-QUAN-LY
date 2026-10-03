import apiClient from './apiClient';
import {
  AppSettings,
  GeneralSettings,
  NeedCategorySetting,
  StatusSetting,
  RecommendationSettings,
  DataGovernanceStatus,
} from '../types/settings';

export const settingsService = {
  getSettings: async (): Promise<AppSettings> => {
    return apiClient.get<AppSettings>('/settings');
  },

  updateGeneral: async (data: Partial<GeneralSettings>): Promise<AppSettings> => {
    return apiClient.patch<AppSettings>('/settings/general', data);
  },

  updateNeedCategories: async (data: NeedCategorySetting[]): Promise<AppSettings> => {
    return apiClient.patch<AppSettings>('/settings/needs', data);
  },

  updateStatuses: async (data: StatusSetting[]): Promise<AppSettings> => {
    return apiClient.patch<AppSettings>('/settings/statuses', data);
  },

  updateRecommendationSettings: async (
    data: Partial<RecommendationSettings>
  ): Promise<AppSettings> => {
    return apiClient.patch<AppSettings>('/settings/recommendations', data);
  },

  getDataGovernanceStatus: async (): Promise<DataGovernanceStatus> => {
    return apiClient.get<DataGovernanceStatus>('/data/status');
  },

  exportData: async (): Promise<void> => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const res = await fetch(`${cleanUrl}/data/export`, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Export request failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `crm_full_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};

export default settingsService;
