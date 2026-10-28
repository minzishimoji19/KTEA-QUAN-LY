export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'YES_NO'
  | 'NUMBER'
  | 'CURRENCY'
  | 'TEXT'
  | 'LONG_TEXT'
  | 'DATE';

export type QuestionnaireVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type ConditionalOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_EMPTY'
  | 'IS_NOT_EMPTY';

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  hasTextInput?: boolean;
  textInputPlaceholder?: string | null;
}

export interface QuestionValidationConfig {
  min?: number | null;
  max?: number | null;
  step?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  minDate?: string | null;
  maxDate?: string | null;
  minSelect?: number | null;
  maxSelect?: number | null;
  pattern?: string | null;
  patternMessage?: string | null;
}

export interface QuestionConditionalLogic {
  dependsOnQuestionCode: string;
  operator: ConditionalOperator;
  value?: any;
}

export interface QuestionDefinition {
  id?: string;
  versionId?: string;
  code: string;
  questionText: string;
  description?: string | null;
  questionType: QuestionType;
  isRequired: boolean;
  displayOrder: number;
  options?: QuestionOption[] | null;
  validationConfig?: QuestionValidationConfig | null;
  conditionalLogic?: QuestionConditionalLogic | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionnaireVersion {
  id: string;
  questionnaireId: string;
  versionNumber: number;
  status: QuestionnaireVersionStatus;
  isCurrent: boolean;
  title?: string | null;
  description?: string | null;
  changeLog?: string | null;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: QuestionDefinition[];
  questionnaire?: {
    id: string;
    code: string;
    title: string;
    description?: string | null;
  };
  _count?: {
    questions: number;
    assessments?: number;
  };
}

export interface Questionnaire {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  versions?: QuestionnaireVersion[];
  hasPublishedOrArchivedVersion?: boolean;
  totalAssessments?: number;
  canHardDelete?: boolean;
}

export interface CreateQuestionnaireInput {
  code: string;
  title: string;
  description?: string | null;
  active?: boolean;
  initialQuestions?: QuestionDefinition[];
}

export interface UpdateQuestionnaireInput {
  title?: string;
  description?: string | null;
  active?: boolean;
}

export interface CreateDraftVersionInput {
  title?: string | null;
  description?: string | null;
  changeLog?: string | null;
  sourceVersionId?: string;
}

export interface PublishVersionInput {
  changeLog?: string | null;
}

export interface VersionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
