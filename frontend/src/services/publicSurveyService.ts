/**
 * publicSurveyService.ts
 * Frontend service for public survey link API (both staff and public endpoints).
 * Public endpoints do NOT use authentication.
 */
import apiClient from './apiClient';
import { getApiBaseUrl } from './apiClient';

export interface PublicSurveyLinkCreateInput {
  questionnaireId?: string;
  questionnaireVersionId?: string;
  notes?: string | null;
}

export interface PublicSurveyLinkItem {
  id: string;
  assessmentId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  revokedAt: string | null;
  completedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  assessment: {
    id: string;
    status: string;
    completedAt: string | null;
    questionnaireVersion: {
      id: string;
      versionNumber: number;
      title: string | null;
      questionnaire: { id: string; code: string; title: string };
    };
  };
  createdBy: { id: string; fullName: string } | null;
  revokedBy: { id: string; fullName: string } | null;
}

export interface CreateLinkResponse {
  linkId: string;
  publicUrl: string;
  rawToken?: string;
  assessmentId: string;
  expiresAt: string;
  status: string;
  questionnaire: { id: string; code: string; title: string };
  createdBy: { id: string; fullName: string; email: string } | null;
  createdAt: string;
}

// Staff authenticated methods
export const publicSurveyService = {
  async createLink(
    customerId: string,
    input: PublicSurveyLinkCreateInput
  ): Promise<CreateLinkResponse> {
    return apiClient.post<CreateLinkResponse>(`/customers/${customerId}/survey-links`, input);
  },

  async listLinks(customerId: string): Promise<PublicSurveyLinkItem[]> {
    return apiClient.get<PublicSurveyLinkItem[]>(`/customers/${customerId}/survey-links`);
  },

  async getLinkById(linkId: string): Promise<PublicSurveyLinkItem> {
    return apiClient.get<PublicSurveyLinkItem>(`/survey-links/${linkId}`);
  },

  async revokeLink(linkId: string): Promise<void> {
    await apiClient.post(`/survey-links/${linkId}/revoke`);
  },
};

// Public (unauthenticated) methods — fetch directly without auth headers
const publicBaseUrl = getApiBaseUrl();

export interface SurveyQuestion {
  id: string;
  code: string;
  questionText: string;
  description: string | null;
  questionType:
    | 'SINGLE_CHOICE'
    | 'MULTIPLE_CHOICE'
    | 'YES_NO'
    | 'NUMBER'
    | 'CURRENCY'
    | 'TEXT'
    | 'LONG_TEXT'
    | 'DATE';
  isRequired: boolean;
  displayOrder: number;
  options: Array<{ value: string; label: string }> | null;
  validationConfig: Record<string, any> | null;
  conditionalLogic: {
    dependsOnQuestionCode: string;
    operator: string;
    value: any;
  } | null;
}

export interface PublicSurveyData {
  linkId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  questionnaire: {
    title: string;
    description: string | null;
    versionNumber: number;
    versionTitle: string;
  };
  questions: SurveyQuestion[];
  savedAnswers: Array<{ questionCode: string; answerValue: any }>;
  assessmentStatus: string;
}

async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${publicBaseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const msg = (data as any)?.error?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const apiResp = data as { data: T };
  return apiResp.data ?? (data as T);
}

export const publicSurveyPublicApi = {
  async getSurveyData(token: string): Promise<PublicSurveyData> {
    return publicFetch<PublicSurveyData>(`/public/survey/${encodeURIComponent(token)}`);
  },

  async saveAnswers(
    token: string,
    answers: Array<{ questionCode: string; answerValue: any; questionId?: string | null }>
  ): Promise<{ saved: number }> {
    return publicFetch<{ saved: number }>(
      `/public/survey/${encodeURIComponent(token)}/answers`,
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }
    );
  },

  async complete(
    token: string,
    answers?: Array<{ questionCode: string; answerValue: any; questionId?: string | null }>
  ): Promise<{ completed: boolean; completedAt: string }> {
    return publicFetch<{ completed: boolean; completedAt: string }>(
      `/public/survey/${encodeURIComponent(token)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ answers: answers || [] }),
      }
    );
  },
};
