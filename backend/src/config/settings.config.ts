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

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    appName: 'K-TEA CRM · Intelligence Workspace',
    defaultPageSize: 10,
    dateFormat: 'YYYY-MM-DD',
    timezone: 'Asia/Ho_Chi_Minh',
  },
  needCategories: [
    {
      code: 'CREDIT_CARD',
      label: 'Credit Card',
      description: 'Revolving credit lines, cashback & travel rewards',
      active: true,
    },
    {
      code: 'PERSONAL_LOAN',
      label: 'Personal Loan',
      description: 'Unsecured installment loans for personal expenses',
      active: true,
    },
    {
      code: 'SME_WORKING_CAPITAL',
      label: 'SME Working Capital',
      description: 'Short-term credit lines and operational liquidity financing',
      active: true,
    },
    {
      code: 'HOME_PURCHASE',
      label: 'Home Mortgage',
      description: 'Residential mortgage financing and equity loans',
      active: true,
    },
    {
      code: 'SAVINGS_YIELD',
      label: 'Savings & Term Deposit',
      description: 'Fixed-term deposit yields and certificates of deposit',
      active: true,
    },
    {
      code: 'PAYMENT_POS',
      label: 'Merchant POS',
      description: 'Merchant payment terminals, QR codes & settlement services',
      active: true,
    },
  ],
  statuses: [
    // Customer Statuses (Vietnamese business lifecycle)
    { domain: 'Customer', code: 'LEAD_MOI', label: 'Lead mới', color: 'blue', description: 'Khách hàng mới tiếp nhận, chưa tiếp cận', isTerminal: false },
    { domain: 'Customer', code: 'DANG_TIEP_CAN', label: 'Đang tiếp cận', color: 'indigo', description: 'Đang trong quá trình tiếp cận và giới thiệu dịch vụ', isTerminal: false },
    { domain: 'Customer', code: 'DANG_TU_VAN', label: 'Đang tư vấn', color: 'amber', description: 'Đang tư vấn chi tiết sản phẩm và giải pháp', isTerminal: false },
    { domain: 'Customer', code: 'THANH_CONG', label: 'Thành công', color: 'emerald', description: 'Khách hàng đã hoàn tất và sử dụng dịch vụ thành công', isTerminal: true },
    { domain: 'Customer', code: 'KHONG_KHA_THI', label: 'Không khả thi', color: 'slate', description: 'Không thể tiếp tục do điều kiện không phù hợp', isTerminal: true },

    // Case Statuses
    { domain: 'Case', code: 'DRAFT', label: 'Draft', color: 'slate', description: 'In-progress dossier preparation before submission', isTerminal: false },
    { domain: 'Case', code: 'SUBMITTED', label: 'Submitted', color: 'blue', description: 'Dispatched to bank underwriting desk', isTerminal: false },
    { domain: 'Case', code: 'UNDER_REVIEW', label: 'Under Review', color: 'amber', description: 'Underwriter assessing income and bureau risk', isTerminal: false },
    { domain: 'Case', code: 'APPROVED', label: 'Approved', color: 'emerald', description: 'Application approved and facility issued', isTerminal: true },
    { domain: 'Case', code: 'REJECTED', label: 'Rejected', color: 'rose', description: 'Application declined by credit risk policy', isTerminal: true },
    { domain: 'Case', code: 'CANCELLED', label: 'Cancelled', color: 'slate', description: 'Customer withdrew application before decision', isTerminal: true },

    // FollowUp Statuses
    { domain: 'FollowUp', code: 'PENDING', label: 'Pending', color: 'amber', description: 'Scheduled task awaiting operator outreach', isTerminal: false },
    { domain: 'FollowUp', code: 'IN_PROGRESS', label: 'In Progress', color: 'blue', description: 'Outreach ongoing or awaiting customer callback', isTerminal: false },
    { domain: 'FollowUp', code: 'COMPLETED', label: 'Completed', color: 'emerald', description: 'Task objective accomplished and logged', isTerminal: true },
    { domain: 'FollowUp', code: 'CANCELLED', label: 'Cancelled', color: 'slate', description: 'Task voided due to status change', isTerminal: true },

    // Push Statuses
    { domain: 'Push', code: 'PENDING', label: 'Pending Dispatch', color: 'amber', description: 'Referral dispatched; pending specialist contact', isTerminal: false },
    { domain: 'Push', code: 'IN_PROGRESS', label: 'In Progress', color: 'blue', description: 'Product specialist actively consulting client', isTerminal: false },
    { domain: 'Push', code: 'SUCCESS', label: 'Converted Success', color: 'emerald', description: 'Specialist converted referral into booked product', isTerminal: true },
    { domain: 'Push', code: 'FAILED', label: 'Declined / Failed', color: 'rose', description: 'Referral failed or customer declined product', isTerminal: true },
    { domain: 'Push', code: 'CANCELLED', label: 'Cancelled', color: 'slate', description: 'Referral retracted by operator', isTerminal: true },

    // Recommendation Statuses
    { domain: 'Recommendation', code: 'NEW', label: 'New Match', color: 'blue', description: 'Fresh rule engine output awaiting qualification', isTerminal: false },
    { domain: 'Recommendation', code: 'REVIEWED', label: 'Reviewed', color: 'indigo', description: 'Operator reviewed and validated opportunity', isTerminal: false },
    { domain: 'Recommendation', code: 'CONVERTED_TO_PUSH', label: 'Referred', color: 'emerald', description: 'Opportunity converted into active push referral', isTerminal: true },
    { domain: 'Recommendation', code: 'DISMISSED', label: 'Dismissed', color: 'slate', description: 'Operator dismissed opportunity with feedback', isTerminal: true },
  ],
  recommendationSettings: {
    minScoreThreshold: 60,
    highPotentialThreshold: 75,
    maxNormalizedScore: 95,
    rules: {
      ruleA: {
        id: 'RULE_A_ACTIVE_LOAN_NEED',
        name: 'Active Loan Need Match',
        enabled: true,
        baseScore: 70,
        description: 'Matches active personal/SME/mortgage loan needs directly to catalog loan products.',
      },
      ruleB: {
        id: 'RULE_B_EXPLICIT_CARD_INTEREST',
        name: 'Explicit Card Interest Match',
        enabled: true,
        baseScore: 70,
        description: 'Matches customer credit card inquiries to Cashback or Platinum Miles cards.',
      },
      ruleC: {
        id: 'RULE_C_CROSS_PRODUCT_TRANSITION',
        name: 'Cross-Product Need Transition',
        enabled: true,
        baseScore: 80,
        description: 'Surfaces cross-sell opportunities when a customer with existing loan history requests card facilities or vice-versa.',
      },
      ruleD: {
        id: 'RULE_D_FAILED_APP_RECOVERY',
        name: 'Failed Application Recovery Opportunity',
        enabled: true,
        baseScore: 85,
        description: 'Recovers customers with prior declined applications who have alternative active needs.',
      },
      ruleE: {
        enabled: true,
        recencyDays1: 7,
        boost1: 10,
        recencyDays2: 14,
        boost2: 5,
      },
      ruleF: {
        enabled: true,
        name: 'No Signal Guard',
        description: 'Blocks unsolicited recommendations when no recorded needs or application signals exist.',
      },
    },
  },
};
