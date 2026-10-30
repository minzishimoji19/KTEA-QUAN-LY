/**
 * akinator.ts
 * TypeScript interfaces and types for the independent Akinator module,
 * strictly matching the Phase 2 Backend API contract.
 */

export type AkinatorQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'YES_NO'
  | 'NUMBER'
  | 'CURRENCY'
  | 'TEXT'
  | 'DATE';

export type AkinatorEvaluationStatus = 'EVALUATED' | 'INSUFFICIENT_DATA';

export type AkinatorQuizStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export type AkinatorWorkflowStatus =
  | 'PENDING_PROCESSING'
  | 'IN_PROGRESS'
  | 'NEEDS_MORE_INFO'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'TRANSFERRED'
  | 'REJECTED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type PriorityLevel =
  | 'CHUA_CO_NHU_CAU'
  | 'THANH_KHOAN'
  | 'TIN_DUNG'
  | 'THANH_KHOAN_TIN_DUNG';

export interface AkinatorQuestionOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface AkinatorValidationConfig {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
}

export interface AkinatorPublicQuestion {
  id: string;
  code: string;
  questionText: string;
  description: string | null;
  questionType: AkinatorQuestionType;
  options: AkinatorQuestionOption[] | null;
  validationConfig: AkinatorValidationConfig | null;
}

export interface AkinatorQuizProgress {
  answeredCount: number;
  remainingEligibleCount: number;
  maxQuestionsPerSession: number;
}

export interface AkinatorCategoryOutcome {
  ruleCode: string;
  ruleName: string;
  categoryCode: string;
  categoryLabel: string;
  referenceTitle: string;
  referenceSummary: string;
  suggestedDirections: string[];
  cautionNotes: string[];
  suggestedPriority: PriorityLevel | null;
}

export interface AkinatorMissingCriterion {
  questionCode: string;
  questionText: string;
  reason: string;
}

export interface AkinatorPublicResult {
  id: string;
  evaluationStatus: AkinatorEvaluationStatus;
  summaryTitle: string;
  summaryDescription: string;
  outcomeData: {
    categories: AkinatorCategoryOutcome[];
    primaryPriority: PriorityLevel | null;
    isReferenceOnly: true;
  };
  missingCriteria: AkinatorMissingCriterion[];
  disclaimerText: string;
  generatedAt: string;
}

export interface AkinatorSessionStartResponse {
  sessionToken: string;
  sessionId: string;
  quizStatus: AkinatorQuizStatus;
  configVersionNumber: number;
  title: string;
  description: string | null;
  disclaimerText: string;
  nextQuestion: AkinatorPublicQuestion | null;
  readyToComplete: boolean;
  progress: AkinatorQuizProgress;
}

export interface AkinatorAnsweredQuestionSnapshot {
  questionCode: string;
  questionText: string;
  answerValue: any;
  answerLabel: string | null;
  stepOrder: number;
}

export interface AkinatorSessionDetailResponse {
  sessionId: string;
  quizStatus: AkinatorQuizStatus;
  configVersionNumber: number;
  title: string;
  description?: string | null;
  disclaimerText?: string;
  completedAt?: string;
  answeredQuestions?: AkinatorAnsweredQuestionSnapshot[];
  nextQuestion?: AkinatorPublicQuestion | null;
  readyToComplete?: boolean;
  progress?: AkinatorQuizProgress;
  result?: AkinatorPublicResult | null;
}

export interface AkinatorAnswerSubmitResponse {
  sessionId: string;
  quizStatus: AkinatorQuizStatus;
  savedAnswer: {
    questionCode: string;
    answerValue: any;
    answerLabel: string | null;
    stepOrder: number;
  };
  nextQuestion: AkinatorPublicQuestion | null;
  readyToComplete: boolean;
  selectionReason: string;
  progress: AkinatorQuizProgress;
}

export interface AkinatorSessionCompleteResponse {
  sessionId: string;
  quizStatus: 'COMPLETED';
  completedAt: string;
  result: AkinatorPublicResult;
  alreadyCompleted?: boolean;
}

export interface AkinatorConfigSummary {
  id: string;
  versionNumber: number;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isCurrent: boolean;
  maxQuestionsPerSession: number;
  disclaimerText: string;
  changeLog?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  publishedById?: string | null;
  createdById?: string | null;
  _count?: {
    questions: number;
    rules: number;
    sessions: number;
  };
  questions?: AkinatorQuestionItem[];
  rules?: AkinatorRuleItem[];
}

export type AkinatorCustomerFieldMapping =
  | 'NONE'
  | 'FULL_NAME'
  | 'PHONE'
  | 'EMAIL'
  | 'DOB'
  | 'GENDER'
  | 'ADDRESS';

export type AkinatorConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'CONTAINS'
  | 'IS_ANSWERED'
  | 'IS_NOT_ANSWERED';

export interface AkinatorSingleCondition {
  questionCode: string;
  operator: AkinatorConditionOperator;
  value?: any;
}

export interface AkinatorConditionGroup {
  logic: 'AND' | 'OR';
  conditions: AkinatorSingleCondition[];
}

export interface AkinatorNextQuestionRule {
  logic: 'AND' | 'OR';
  conditions: AkinatorSingleCondition[];
  action: 'GOTO_QUESTION' | 'END_QUIZ';
  targetQuestionCode?: string | null;
  reason?: string | null;
}

export interface AkinatorQuestionItem {
  id?: string;
  code: string;
  questionText: string;
  description?: string | null;
  questionType: AkinatorQuestionType;
  isEntryQuestion: boolean;
  isRequiredForEval: boolean;
  priorityWeight: number;
  mapsToCustomerField: AkinatorCustomerFieldMapping;
  options?: AkinatorQuestionOption[] | null;
  validationConfig?: AkinatorValidationConfig | null;
  visibilityConditions?: AkinatorConditionGroup | null;
  nextQuestionRules?: AkinatorNextQuestionRule[] | null;
  active?: boolean;
}

export interface AkinatorRuleOutcomePayload {
  categoryCode: string;
  categoryLabel: string;
  referenceTitle: string;
  referenceSummary: string;
  suggestedDirections: string[];
  cautionNotes: string[];
  suggestedPriority?: PriorityLevel | null;
}

export interface AkinatorRuleItem {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  priorityOrder: number;
  requiredQuestionCodes: string[];
  conditions: AkinatorConditionGroup;
  outcomePayload: AkinatorRuleOutcomePayload;
  stopOnMatch?: boolean;
  active?: boolean;
}

export interface AkinatorConfigDetail extends AkinatorConfigSummary {
  questions: AkinatorQuestionItem[];
  rules: AkinatorRuleItem[];
}

export interface AkinatorValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CreateAkinatorDraftInput {
  title: string;
  description?: string | null;
  maxQuestionsPerSession?: number;
  disclaimerText?: string;
  changeLog?: string | null;
  sourceVersionId?: string;
}

export interface UpdateAkinatorDraftMetadataInput {
  title?: string;
  description?: string | null;
  maxQuestionsPerSession?: number;
  disclaimerText?: string;
  changeLog?: string | null;
}

export interface AkinatorRawAnswerItem {
  id: string;
  sessionId: string;
  questionId: string;
  questionCode: string;
  questionTextSnapshot: string;
  answerValue: any;
  answerLabelSnapshot: string | null;
  selectionReason: string | null;
  stepOrder: number;
  answeredAt: string;
}

export interface AkinatorAdminReviewItem {
  id: string;
  sessionId: string;
  editedFullName: string | null;
  editedPhone: string | null;
  editedEmail: string | null;
  editedGender: Gender | null;
  editedDateOfBirth: string | null;
  editedAddress: string | null;
  editedSource: string | null;
  editedPriority: PriorityLevel | null;
  processorNote: string | null;
  missingInfoNote: string | null;
  approvalNote: string | null;
  rejectionReason: string | null;
  assignedAdminId: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  linkedCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AkinatorStatusHistoryItem {
  id: string;
  sessionId: string;
  fromStatus: AkinatorWorkflowStatus | null;
  toStatus: AkinatorWorkflowStatus;
  actionType: string;
  changedFieldsSnapshot?: any;
  note: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface AkinatorSessionListItem {
  id: string;
  quizStatus: AkinatorQuizStatus;
  workflowStatus: AkinatorWorkflowStatus | null;
  rawFullName: string | null;
  rawPhone: string | null;
  rawEmail: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  configVersion: {
    id: string;
    versionNumber: number;
    title: string;
  };
  result: {
    id: string;
    evaluationStatus: AkinatorEvaluationStatus;
    summaryTitle: string;
    generatedAt: string;
  } | null;
  adminReview: AkinatorAdminReviewItem | null;
  _count?: {
    rawAnswers: number;
  };
}

export interface AkinatorSessionDetail {
  id: string;
  quizStatus: AkinatorQuizStatus;
  workflowStatus: AkinatorWorkflowStatus | null;
  rawFullName: string | null;
  rawPhone: string | null;
  rawEmail: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  configVersion: {
    id: string;
    versionNumber: number;
    title: string;
    status: string;
    publishedAt: string | null;
  };
  rawAnswers: AkinatorRawAnswerItem[];
  result: {
    id: string;
    sessionId: string;
    configVersionId: string;
    evaluationStatus: AkinatorEvaluationStatus;
    summaryTitle: string;
    summaryDescription: string;
    outcomeData: any;
    missingCriteria: any;
    matchedRulesSnapshot: any;
    answersSnapshot: any;
    disclaimerText: string;
    generatedAt: string;
  } | null;
  adminReview: AkinatorAdminReviewItem | null;
  statusHistories: AkinatorStatusHistoryItem[];
}

export interface AkinatorSessionListFilter {
  page?: number;
  pageSize?: number;
  quizStatus?: AkinatorQuizStatus;
  workflowStatus?: AkinatorWorkflowStatus;
  evaluationStatus?: AkinatorEvaluationStatus;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AkinatorSessionListResponse {
  items: AkinatorSessionListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export interface UpdateAkinatorReviewInput {
  editedFullName?: string | null;
  editedPhone?: string | null;
  editedEmail?: string | null;
  editedGender?: Gender | null;
  editedDateOfBirth?: string | null;
  editedAddress?: string | null;
  editedSource?: string | null;
  editedPriority?: PriorityLevel | null;
  processorNote?: string | null;
  missingInfoNote?: string | null;
  approvalNote?: string | null;
}

export interface TransitionAkinatorWorkflowInput {
  toStatus: AkinatorWorkflowStatus;
  note?: string | null;
  missingInfoNote?: string | null;
  approvalNote?: string | null;
  rejectionReason?: string | null;
}

export interface DuplicateCustomerMatch {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  overallStatus: string;
  priority?: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CheckDuplicateCustomerResponse {
  sessionId: string;
  phone: string | null;
  normalizedPhone: string | null;
  hasDuplicate: boolean;
  matches: DuplicateCustomerMatch[];
}

export interface TransferAkinatorSessionInput {
  mode: 'LINK_EXISTING' | 'CREATE_NEW';
  existingCustomerId?: string;
  confirmCreateNew?: boolean;
}

export interface TransferAkinatorSessionResponse {
  alreadyTransferred: boolean;
  sessionId: string;
  customerId: string;
  customer: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    overallStatus: string;
  };
  mode: string;
  message: string;
}

// =========================================================================
// CUSTOMER AKINATOR SESSIONS (CRM WORKSPACE)
// =========================================================================

export interface CustomerAkinatorSessionItem {
  id: string;
  quizStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED' | 'REVOKED';
  startedAt?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastAccessedAt?: string | null;
  createdAt: string;
  configVersion?: {
    id: string;
    versionNumber: number;
    title: string;
  };
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  hasResult: boolean;
  answeredCount: number;
  resultSummary?: {
    summaryTitle: string;
    evaluationStatus: string;
    generatedAt: string;
  } | null;
}

export interface CustomerAkinatorLatestResult {
  sessionId: string;
  completedAt: string;
  startedAt?: string | null;
  createdAt: string;
  configVersion?: {
    id: string;
    versionNumber: number;
    title: string;
    disclaimerText?: string;
  };
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  result: {
    id: string;
    evaluationStatus: 'EVALUATED' | 'INSUFFICIENT_DATA';
    summaryTitle: string;
    summaryDescription: string;
    outcomeData: {
      categories: Array<{
        ruleCode: string;
        ruleName: string;
        categoryCode: string;
        categoryLabel: string;
        referenceTitle: string;
        referenceSummary: string;
        suggestedDirections: string[];
        cautionNotes: string[];
        suggestedPriority?: string | null;
      }>;
      primaryPriority?: string | null;
      isReferenceOnly: boolean;
    };
    missingCriteria?: Array<{
      questionCode: string;
      questionText: string;
      reason: string;
    }>;
    matchedRulesSnapshot?: any[];
    answersSnapshot?: Record<string, any>;
    disclaimerText: string;
    generatedAt: string;
  };
  answeredQuestions?: Array<{
    questionCode: string;
    questionText: string;
    answerValue: any;
    answerLabel?: string | null;
    stepOrder: number;
  }>;
}

export interface CreateCustomerAkinatorLinkResponse {
  sessionId: string;
  publicUrl: string;
  rawToken: string;
  expiresAt: string;
  status: string;
  customerId: string;
  configVersion: {
    id: string;
    versionNumber: number;
    title: string;
  };
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdAt: string;
}
