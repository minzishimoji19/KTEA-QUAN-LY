import {
  CustomerStatus,
  PriorityLevel,
  NeedStatus,
  CaseStatus,
  ActivityType,
  PushStatus,
  RecommendationStatus,
  Product,
} from '@prisma/client';

export interface CustomerFeatures {
  customerId: string;
  fullName: string;
  phone: string;
  overallStatus: CustomerStatus;
  priority: PriorityLevel | null;
  activeNeeds: Array<{
    id: string;
    needType: string;
    status: NeedStatus;
    notes: string | null;
    detectedAt: Date;
  }>;
  resolvedNeeds: Array<{
    id: string;
    needType: string;
    status: NeedStatus;
    resolvedAt: Date | null;
  }>;
  applicationHistory: Array<{
    id: string;
    productId: string;
    productCode: string;
    productName: string;
    status: CaseStatus;
    failureReason: string | null;
    createdAt: Date;
  }>;
  recentActivities: Array<{
    id: string;
    type: ActivityType;
    title: string;
    occurredAt: Date;
  }>;
  daysSinceLastActivity: number | null;
  existingPushes: Array<{
    id: string;
    targetProductId: string | null;
    status: PushStatus;
    pushedAt: Date;
  }>;
  existingRecommendations: Array<{
    id: string;
    targetProductId: string | null;
    status: RecommendationStatus;
    generatedAt: Date;
  }>;
}

export interface RuleEvaluationResult {
  matched: boolean;
  ruleId: string;
  ruleName: string;
  targetProductMatcher: {
    codePatterns: string[];
    fallbackCategory: string;
  };
  baseScore: number; // 0-100
  reason: string;
  signals: string[];
}

export interface RecommendationCandidate {
  customerId: string;
  targetProductId: string;
  targetProductCode: string;
  targetProductName: string;
  recommendationType: string;
  score: number; // 0-100 normalized deterministic score
  reason: string;
  signals: string[];
  ruleId: string;
}

export interface IRecommendationRule {
  id: string;
  name: string;
  evaluate(features: CustomerFeatures, config?: any): RuleEvaluationResult | null;
}

export interface IRecommendationEngine {
  evaluate(
    features: CustomerFeatures,
    availableProducts: Product[],
    config?: any
  ): RecommendationCandidate[];
}
