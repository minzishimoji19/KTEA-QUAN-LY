import fs from 'fs';
import path from 'path';
import { AppSettings, DEFAULT_SETTINGS, GeneralSettings, NeedCategorySetting, StatusSetting, RecommendationSettings } from '../config/settings.config.js';

const DATA_DIR = typeof __dirname !== 'undefined'
  ? path.resolve(__dirname, '../../data')
  : path.resolve(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export class SettingsRepository {
  private cache: AppSettings | null = null;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(SETTINGS_FILE)) {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
        this.cache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      } else {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
        this.cache = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error('[SettingsRepository] Error initializing settings store:', err);
      this.cache = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  async getSettings(): Promise<AppSettings> {
    if (!this.cache) {
      this.ensureInitialized();
    }
    return JSON.parse(JSON.stringify(this.cache!));
  }

  async saveSettings(newSettings: AppSettings): Promise<AppSettings> {
    this.cache = newSettings;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsRepository] Error writing settings to disk:', err);
    }
    return this.getSettings();
  }

  async updateGeneral(general: Partial<GeneralSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      general: {
        ...current.general,
        ...general,
      },
    };
    return this.saveSettings(updated);
  }

  async updateNeedCategories(categories: NeedCategorySetting[]): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      needCategories: categories,
    };
    return this.saveSettings(updated);
  }

  async updateStatuses(statuses: StatusSetting[]): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      statuses,
    };
    return this.saveSettings(updated);
  }

  async updateRecommendationSettings(
    recs: Partial<RecommendationSettings>
  ): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      recommendationSettings: {
        ...current.recommendationSettings,
        ...recs,
        rules: {
          ...current.recommendationSettings.rules,
          ...(recs.rules || {}),
        },
      },
    };
    return this.saveSettings(updated);
  }
}

export const settingsRepository = new SettingsRepository();
export default settingsRepository;
