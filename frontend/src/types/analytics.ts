export interface DatePeriod {
  startDate: string | null;
  endDate: string | null;
}

export interface MetricWithDefinition {
  value: number;
  numerator: number;
  denominator: number;
  definition: string;
}

export interface OverviewMetrics {
  totalCustomers: number;
  newCustomersInPeriod: number;
  activeCustomers: number;
  customersWithActiveNeeds: number;
  customersRequiringFollowUp: number;
  overdueFollowUps: number;
  totalCases: number;
  successfulCases: number;
  failedCases: number;
  pendingCases: number;
  pushCandidates: number;
  totalPushes: number;
  successfulPushes: number;
  failedPushes: number;
}

export interface OverviewResponse {
  metrics: OverviewMetrics;
  customersByStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  period: DatePeriod;
  definitions: Record<string, string>;
}

export interface CustomerAnalyticsResponse {
  summary: {
    totalCustomers: number;
    activeCustomers: number;
  };
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  byProduct: Array<{
    productId: string;
    productCode: string;
    productName: string;
    customerCount: number;
    totalCases: number;
    approvedCases: number;
  }>;
  byNeed: Array<{
    needType: string;
    count: number;
    customerCount: number;
    percentage: number;
  }>;
  bySource: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  creationTrend: Array<{
    date: string;
    count: number;
  }>;
  period: DatePeriod;
}

export interface CaseAnalyticsResponse {
  totalCases: number;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  byProduct: Array<{
    productId: string;
    productCode: string;
    productName: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    approvalRateOnResolved: MetricWithDefinition;
  }>;
  successVsFailure: {
    approved: number;
    rejected: number;
    cancelled: number;
    pending: number;
    resolvedTotal: number;
    approvalRateOnResolved: MetricWithDefinition;
    rejectionRateOnResolved: MetricWithDefinition;
  };
  casesOverTime: Array<{
    date: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  }>;
  topFailureReasons: Array<{
    reason: string;
    count: number;
  }>;
  period: DatePeriod;
}

export interface NeedAnalyticsResponse {
  totalNeeds: number;
  mostCommonNeeds: Array<{
    needType: string;
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    dropped: number;
    percentage: number;
  }>;
  activeNeeds: Array<{
    needType: string;
    count: number;
  }>;
  resolvedNeeds: Array<{
    needType: string;
    count: number;
  }>;
  needsByProduct: Array<{
    needType: string;
    relatedProducts: string[];
    needCount: number;
    associatedCasesCount: number;
  }>;
  trendOverTime: Array<{
    date: string;
    count: number;
  }>;
  period: DatePeriod;
}

export interface PushAnalyticsResponse {
  recommendationsGenerated: number;
  recommendationsByStatus: Array<{
    status: string;
    count: number;
  }>;
  pushesCreated: number;
  resultDistribution: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  pushesByTargetProduct: Array<{
    productId: string;
    productCode: string;
    productName: string;
    total: number;
    success: number;
    failed: number;
    pending: number;
    terminalSuccessRate: MetricWithDefinition;
  }>;
  pushSuccessMetrics: {
    totalPushes: number;
    successfulPushes: number;
    failedPushes: number;
    pendingPushes: number;
    terminalPushes: number;
    successRateOfTerminalPushes: MetricWithDefinition;
    successRateOfTotalPushes: MetricWithDefinition;
  };
  pushTrendOverTime: Array<{
    date: string;
    total: number;
    success: number;
    failed: number;
    pending: number;
  }>;
  topFailureReasons: Array<{
    reason: string;
    count: number;
  }>;
  period: DatePeriod;
}
