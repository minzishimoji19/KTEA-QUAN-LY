import { QuestionnaireVersion } from './questionnaire';

export type AssessmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AssessmentAnswer {
  id?: string;
  assessmentId?: string;
  questionId?: string | null;
  questionCode: string;
  answerValue: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface Assessment {
  id: string;
  customerId: string;
  questionnaireVersionId: string;
  status: AssessmentStatus;
  performedById?: string | null;
  startedAt: string;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
  };
  questionnaireVersion: QuestionnaireVersion;
  performedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  } | null;
  answers?: AssessmentAnswer[];
  _count?: {
    answers: number;
  };
}

export interface CreateAssessmentInput {
  questionnaireId?: string;
  questionnaireVersionId?: string;
  notes?: string | null;
}

export interface SaveAssessmentAnswersInput {
  answers: Array<{
    questionCode: string;
    questionId?: string | null;
    answerValue: any;
  }>;
  notes?: string | null;
}
