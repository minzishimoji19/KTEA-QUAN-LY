export type ProductCategory =
  | 'LOAN_UNSECURED'
  | 'LOAN_SECURED'
  | 'CREDIT_CARD'
  | 'INSURANCE'
  | 'SAVINGS'
  | 'OTHER';

export type RecommendationRunStatus = 'COMPLETED' | 'FAILED';
export type RuleVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PassedCriterion {
  id: string;
  description: string;
  details?: string;
}

export interface FailedCriterion {
  id: string;
  description: string;
  reason: string;
}

export interface UnassessedCriterion {
  id: string;
  description: string;
  missingField: string;
  reason: string;
}

export interface AnswerUsed {
  questionCode: string;
  answerValue: any;
}

export interface AssessmentRecommendationItem {
  id: string;
  runId: string;
  productId: string;
  productName: string;
  productCode: string;
  productCategory: ProductCategory;
  productSnapshot: any;
  score: number | string;
  confidence?: number;
  rank: number;
  isEligible: boolean;
  matchSummary: string;
  passedCriteria: PassedCriterion[];
  failedCriteria: FailedCriterion[];
  unassessedCriteria: UnassessedCriterion[];
  warnings: string[];
  answersUsed: AnswerUsed[];
  createdAt: string;
  product?: {
    id: string;
    code: string;
    name: string;
    active: boolean;
  };
}

export interface AssessmentRecommendationRun {
  id: string;
  customerId: string;
  assessmentId: string;
  ruleVersionId: string;
  performedById?: string | null;
  status: RecommendationRunStatus;
  answersSnapshot: Record<string, any>;
  rulesSnapshot: any;
  totalCandidatesEvaluated: number;
  totalRecommended: number;
  executionTimeMs?: number | null;
  notes?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    email?: string | null;
  };
  assessment?: {
    id: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    questionnaireVersion?: {
      versionNumber: number;
      questionnaire?: {
        title: string;
        code: string;
      };
    };
  };
  ruleVersion?: {
    id?: string;
    versionNumber: number;
    ruleSet?: {
      title: string;
      code: string;
    };
  };
  performedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  items?: AssessmentRecommendationItem[];
  _count?: {
    items: number;
  };
}

export interface RunRecommendationInput {
  notes?: string | null;
  ruleVersionId?: string | null;
}
