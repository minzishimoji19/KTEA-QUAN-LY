import { settingsRepository } from '../repositories/settings.repository.js';
import {
  AppSettings,
  GeneralSettings,
  NeedCategorySetting,
  StatusSetting,
  RecommendationSettings,
} from '../config/settings.config.js';
import BaseService from './base.service.js';

import prisma from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

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

  async deleteNeedCategory(code: string): Promise<AppSettings> {
    const settings = await settingsRepository.getSettings();
    const normalizedCode = code.trim().toUpperCase();
    const category = settings.needCategories.find((c) => c.code.toUpperCase() === normalizedCode);
    if (!category) {
      throw new NotFoundError(`Nhóm nhu cầu với mã '${code}' không tồn tại`);
    }

    // Check if any CustomerNeed in database references this category
    const inUseCount = await prisma.customerNeed.count({
      where: {
        OR: [
          { needType: category.code },
          { needType: category.label },
          { needType: { contains: category.code } },
        ],
      },
    });

    if (inUseCount > 0) {
      throw new ConflictError(
        `Không thể xóa nhóm nhu cầu "${category.label}" (${category.code}) do đang được liên kết với ${inUseCount} nhu cầu khách hàng. Vui lòng tạm tắt hoạt động thay vì xóa.`
      );
    }

    const filtered = settings.needCategories.filter((c) => c.code.toUpperCase() !== normalizedCode);
    return settingsRepository.updateNeedCategories(filtered);
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
