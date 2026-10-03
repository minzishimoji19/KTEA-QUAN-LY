export interface GeneralSettings {
  appName: string;
  defaultPageSize: number;
  dateFormat: string;
  timezone: string;
}

export interface NeedCategorySetting {
  code: string;
  label: string;
  description: string;
  active: boolean;
}

export interface StatusSetting {
  domain: 'Customer' | 'Case' | 'FollowUp' | 'Push' | 'Recommendation';
  code: string;
  label: string;
  color: string;
  description: string;
  isTerminal: boolean;
}

export interface RuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  baseScore: number;
  description: string;
}

export interface RecencyBoostConfig {
  enabled: boolean;
  recencyDays1: number;
  boost1: number;
  recencyDays2: number;
  boost2: number;
}

export interface RecommendationSettings {
  minScoreThreshold: number;
  highPotentialThreshold: number;
  maxNormalizedScore: number;
  rules: {
    ruleA: RuleConfig;
    ruleB: RuleConfig;
    ruleC: RuleConfig;
    ruleD: RuleConfig;
    ruleE: RecencyBoostConfig;
    ruleF: { enabled: boolean; name: string; description: string };
  };
}

export interface AppSettings {
  general: GeneralSettings;
  needCategories: NeedCategorySetting[];
  statuses: StatusSetting[];
  recommendationSettings: RecommendationSettings;
}

export interface DatabaseStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
  dialect: string;
  pingLatencyMs: number;
  tables: {
    customers: number;
    products: number;
    cases: number;
    needs: number;
    activities: number;
    notes: number;
    tags: number;
    followUps: number;
    recommendations: number;
    pushRecords: number;
  };
  connectedAt: string;
}

export interface DemoModeStatus {
  isDemoMode: boolean;
  demoCustomerCount: number;
  totalCustomers: number;
  detectedSeedIndicators: string[];
  guidanceNote: string;
}

export interface BackupGuidance {
  logicalBackup: {
    command: string;
    description: string;
  };
  restoreGuidance: {
    command: string;
    description: string;
  };
  recommendedCadence: string[];
  retentionPolicy: string;
}

export interface DataGovernanceStatus {
  database: DatabaseStatus;
  demoMode: DemoModeStatus;
  backupGuidance: BackupGuidance;
}
