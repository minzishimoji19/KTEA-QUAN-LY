import { settingsRepository } from '../repositories/settings.repository.js';
import {
  AppSettings,
  GeneralSettings,
  NeedCategorySetting,
  StatusSetting,
  RecommendationSettings,
} from '../config/settings.config.js';
import BaseService from './base.service.js';

export class SettingsService extends BaseService {
  async getSettings(): Promise<AppSettings> {
    return settingsRepository.getSettings();
  }

  async updateGeneral(data: Partial<GeneralSettings>): Promise<AppSettings> {
    return settingsRepository.updateGeneral(data);
  }

  async updateNeedCategories(data: NeedCategorySetting[]): Promise<AppSettings> {
    return settingsRepository.updateNeedCategories(data);
  }

  async updateStatuses(data: StatusSetting[]): Promise<AppSettings> {
    return settingsRepository.updateStatuses(data);
  }

  async updateRecommendationSettings(
    data: Partial<RecommendationSettings>
  ): Promise<AppSettings> {
    return settingsRepository.updateRecommendationSettings(data);
  }

  async getRecommendationSettings(): Promise<RecommendationSettings> {
    const settings = await settingsRepository.getSettings();
    return settings.recommendationSettings;
  }
}

export const settingsService = new SettingsService();
export default settingsService;
