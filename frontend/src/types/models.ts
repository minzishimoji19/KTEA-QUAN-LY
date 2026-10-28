export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type CaseProgress =
  | 'NOT_SELECTED'
  | 'REGISTRATION_CREATED'
  | 'REGISTRATION_COMPLETED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'CARD_ISSUED'
  | 'CARD_ACTIVATED'
  | 'COMPLETED';

export type CustomerStatus =
  | 'LEAD_MOI'
  | 'DANG_TIEP_CAN'
  | 'DANG_TU_VAN'
  | 'THANH_CONG'
  | 'KHONG_KHA_THI'
  | CaseProgress;

export type PriorityLevel =
  | 'CHUA_CO_NHU_CAU'
  | 'THANH_KHOAN'
  | 'TIN_DUNG'
  | 'THANH_KHOAN_TIN_DUNG';

export type BulkActionType = 'UPDATE_STATUS' | 'UPDATE_PRIORITY' | 'ADD_TAG' | 'ASSIGN_SOURCE' | 'DELETE_CUSTOMERS';

export const CARETAKERS = ['Ktea', 'xoaicaldez', 'mfast'] as const;

export interface CaretakerLinkedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'PARTNER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  phone?: string | null;
}

export interface Caretaker {
  id: string;
  name: string;
  active: boolean;
  userId?: string | null;
  user?: CaretakerLinkedUser | null;
  isVirtualPartner?: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    followUps: number;
  };
}

export interface AvailablePartner {
  id: string;
  email: string;
  fullName: string;
  role: 'PARTNER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  phone?: string | null;
  createdAt: string;
  isLinked: boolean;
  linkedCaretaker: {
    id: string;
    name: string;
    active: boolean;
  } | null;
}

export interface BulkActionResult {
  affected: number;
  action: string;
  customerIds: string[];
  failedCount?: number;
  failedDetails?: Array<{ id: string; name?: string; reason: string }>;
}

export interface BulkActionRequest {
  action: BulkActionType;
  customerIds: string[];
  payload?: {
    status?: CustomerStatus;
    priority?: PriorityLevel;
    tagId?: string;
    sourceId?: string;
  };
}

export type NeedStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DROPPED';

export type CaseStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'COMPLETED';


export interface CustomerSource {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaseProgressHistory {
  id: string;
  caseId: string;
  fromProgress: CaseProgress;
  toProgress: CaseProgress;
  changedAt: string;
  note?: string | null;
  createdAt: string;
}

export type ActivityType =
  | 'CONTACT'
  | 'CALL'
  | 'MESSAGE'
  | 'APPLICATION_CREATED'
  | 'APPLICATION_UPDATED'
  | 'STATUS_CHANGED'
  | 'NEED_DETECTED'
  | 'FOLLOW_UP'
  | 'PUSH_CREATED'
  | 'PUSH_RESULT'
  | 'NOTE_CREATED'
  | 'SYSTEM_EVENT'
  | 'PUSH_SENT'
  | 'MEETING'
  | 'NOTE'
  | 'CREATE_CASE'
  | 'SELECT_PRODUCT'
  | 'PROGRESS_CHANGED'
  | 'REJECTED'
  | 'APPROVED'
  | 'CARD_ISSUED'
  | 'CARD_ACTIVATED'
  | 'COMPLETED';

export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type RecommendationStatus =
  | 'NEW'
  | 'REVIEWED'
  | 'DISMISSED'
  | 'CONVERTED_TO_PUSH'
  | 'ACTIVE'
  | 'ACCEPTED'
  | 'EXPIRED';

export type PushStatus = 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type SurveyDisplayStatus = 'NOT_CREATED' | 'SENT' | 'COMPLETED';

export interface CustomerSurveyStats {
  completedCount: number;
  activeLinkCount: number;
  expiredLinkCount: number;
  revokedLinkCount: number;
  hasDraftProgress: boolean;
  hasOpenedLink: boolean;
  hasExpiredOrRevokedLinks: boolean;
  latestInactiveLinkStatus: 'EXPIRED' | 'REVOKED' | null;
  latestCompletedAt: string | null;
  latestLinkCreatedAt: string | null;
  latestLinkExpiresAt: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  createdAt: string;
  _count?: {
    customerTags: number;
  };
}

export interface CustomerTag {
  customerId: string;
  tagId: string;
  tag: Tag;
}

export type ProductCategory =
  | 'LOAN_UNSECURED'
  | 'LOAN_SECURED'
  | 'CREDIT_CARD'
  | 'INSURANCE'
  | 'SAVINGS'
  | 'OTHER';

export type InterestRateUnit =
  | 'PERCENT_PER_YEAR'
  | 'PERCENT_PER_MONTH';

export interface ProductFinancialDetail {
  id?: string;
  productId?: string;
  category: ProductCategory;
  providerName?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  minInterestRate?: number | null;
  maxInterestRate?: number | null;
  interestRateUnit?: InterestRateUnit;
  minTenureMonths?: number | null;
  maxTenureMonths?: number | null;
  feesDescription?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  minIncome?: number | null;
  acceptBadDebt?: boolean;
  eligibilityCriteria?: string[] | Record<string, unknown> | null;
  benefits?: string[] | null;
  risks?: string[] | null;
  officialUrl?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  financialDetail?: ProductFinancialDetail | null;
  _count?: {
    cases: number;
    recommendations: number;
    pushRecords: number;
  };
}

export interface CustomerCase {
  id: string;
  customerId: string;
  productId?: string | null;
  caseStatus: CaseStatus;
  progress?: CaseProgress;
  applicationDate?: string | null;
  resultDate?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  rejectionNote?: string | null;
  failureReason?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product | null;
  progressHistory?: CaseProgressHistory[];
}

export interface CustomerNeed {
  id: string;
  customerId: string;
  needType: string;
  status: NeedStatus;
  detectedAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerActivity {
  id: string;
  customerId: string;
  type: ActivityType;
  title: string;
  description?: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  title: string;
  description?: string | null;
  dueAt: string;
  status: FollowUpStatus;
  completedAt?: string | null;
  assignedTo?: string | null;
  assignedToUserId?: string | null;
  assignedToUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  isCurrentlyAssignedToMe?: boolean;
  isHistoricalForMe?: boolean;
  assignmentStatus?: 'CURRENT' | 'HISTORICAL';
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    overallStatus: CustomerStatus;
    priority?: PriorityLevel | null;
  };
}

export interface Recommendation {
  id: string;
  customerId: string;
  targetProductId?: string | null;
  recommendationType: string;
  score?: number | string | null;
  reason: string;
  status: RecommendationStatus;
  generatedAt: string;
  dismissedAt?: string | null;
  createdAt: string;
  targetProduct?: Product | null;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    overallStatus: CustomerStatus;
    priority?: PriorityLevel | null;
    cases?: CustomerCase[];
    followUps?: FollowUp[];
    activities?: CustomerActivity[];
    needs?: CustomerNeed[];
  };
  pushRecords?: PushRecord[];
}

export interface PushRecord {
  id: string;
  customerId: string;
  recommendationId?: string | null;
  targetProductId?: string | null;
  pushedAt: string;
  status: PushStatus;
  resultAt?: string | null;
  failureReason?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  targetProduct?: Product | null;
  recommendation?: Recommendation | null;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    overallStatus: CustomerStatus;
  };
}

export interface CustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  address?: string | null;
  note?: string | null;
  source?: string | null;
  sourceId?: string | null;
  customerSource?: CustomerSource | null;
  overallStatus: CustomerStatus;
  rawOverallStatus?: CustomerStatus;
  careStatus?: CustomerStatus;
  priority?: PriorityLevel | null;
  createdAt: string;
  updatedAt: string;
  customerTags: CustomerTag[];
  careCount?: number;
  lastCareAt?: string | null;
  latestCareStatus?: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED' | 'NONE';
  completedCareCount?: number;
  pendingCareCount?: number;
  surveyStatus?: SurveyDisplayStatus;
  surveyStatusLabel?: string;
  surveyStats?: CustomerSurveyStats;
  careFollowUps?: Array<{
    id: string;
    title: string;
    status: string;
    effectiveStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED';
    dueAt: string;
    completedAt: string | null;
    assignedTo: string | null;
    isCurrentlyAssignedToMe?: boolean;
    isHistoricalForMe?: boolean;
    assignmentStatus?: 'CURRENT' | 'HISTORICAL';
    canEdit?: boolean;
  }>;
  assignedCaregivers?: Array<{
    id: string;
    fullName: string;
    email?: string | null;
    role?: string;
    status?: string;
    assignedAt?: string;
  }>;
  assignedCaregiverName?: string;
  caregiverName?: string;
  isCurrentlyAssignedToMe?: boolean;
  isHistoricalForMe?: boolean;
  assignmentStatus?: 'CURRENT' | 'HISTORICAL';
  canEditCustomer?: boolean;
  assignments?: Array<{
    id: string;
    userId: string;
    assignedAt: string;
    user: {
      id: string;
      fullName: string;
      email?: string | null;
      role?: string;
      status?: string;
    };
  }>;
  cases?: CustomerCase[];
  needs?: CustomerNeed[];
  activities?: CustomerActivity[];
  followUps?: FollowUp[];
  recommendations?: Recommendation[];
  _count?: {
    cases: number;
    needs: number;
    activities: number;
    followUps: number;
  };
}

export interface CustomerDetail extends CustomerSummary {
  cases: CustomerCase[];
  needs: CustomerNeed[];
  activities: CustomerActivity[];
  notes: CustomerNote[];
  followUps: FollowUp[];
  recommendations: Recommendation[];
  pushRecords: PushRecord[];
}
