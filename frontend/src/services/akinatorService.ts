/**
 * akinatorService.ts
 *
 * Frontend API client for the independent Akinator module:
 * - Public Quiz endpoints (/api/public/akinator/*)
 * - Admin Configuration & Session endpoints (/api/akinator/*)
 */
import apiClient from './apiClient';
import {
  AkinatorSessionStartResponse,
  AkinatorSessionDetailResponse,
  AkinatorAnswerSubmitResponse,
  AkinatorSessionCompleteResponse,
  AkinatorConfigSummary,
  AkinatorConfigDetail,
  AkinatorQuestionItem,
  AkinatorRuleItem,
  AkinatorValidationResult,
  CreateAkinatorDraftInput,
  UpdateAkinatorDraftMetadataInput,
  AkinatorSessionListFilter,
  AkinatorSessionListResponse,
  AkinatorSessionDetail,
  AkinatorAdminReviewItem,
  UpdateAkinatorReviewInput,
  TransitionAkinatorWorkflowInput,
  CheckDuplicateCustomerResponse,
  TransferAkinatorSessionInput,
  TransferAkinatorSessionResponse,
} from '../types/akinator';

export const akinatorPublicApi = {
  /**
   * Initializes a new interactive quiz session with the current published configuration.
   */
  async startSession(): Promise<AkinatorSessionStartResponse> {
    return apiClient.post<AkinatorSessionStartResponse>('/public/akinator/sessions');
  },

  /**
   * Fetches an existing quiz session by its token.
   * Allows seamless resume on page reload or reconnect.
   */
  async getSessionByToken(token: string): Promise<AkinatorSessionDetailResponse> {
    return apiClient.get<AkinatorSessionDetailResponse>(
      `/public/akinator/sessions/${encodeURIComponent(token)}`
    );
  },

  /**
   * Submits an answer to the current question and receives the next adaptive question.
   */
  async submitAnswer(
    token: string,
    questionCode: string,
    answerValue: any
  ): Promise<AkinatorAnswerSubmitResponse> {
    return apiClient.post<AkinatorAnswerSubmitResponse>(
      `/public/akinator/sessions/${encodeURIComponent(token)}/answers`,
      {
        questionCode,
        answerValue,
      }
    );
  },

  /**
   * Completes the quiz session, runs the backend Rule Engine, and fetches the preliminary result.
   */
  async completeSession(token: string): Promise<AkinatorSessionCompleteResponse> {
    return apiClient.post<AkinatorSessionCompleteResponse>(
      `/public/akinator/sessions/${encodeURIComponent(token)}/complete`
    );
  },
};

export const akinatorAdminApi = {
  /**
   * Fetches the currently published configuration version.
   */
  async getCurrentPublishedConfig(): Promise<AkinatorConfigDetail | null> {
    return apiClient.get<AkinatorConfigDetail | null>('/akinator/configs/current');
  },

  /**
   * Lists configuration versions (Admin only).
   */
  async listConfigs(status?: string): Promise<AkinatorConfigSummary[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<AkinatorConfigSummary[]>(`/akinator/configs${query}`);
  },

  /**
   * Fetches full detail of a specific configuration version (including questions & rules).
   */
  async getConfigById(versionId: string): Promise<AkinatorConfigDetail> {
    return apiClient.get<AkinatorConfigDetail>(`/akinator/configs/${encodeURIComponent(versionId)}`);
  },

  /**
   * Creates a new draft configuration version (blank or cloned from sourceVersionId).
   */
  async createDraftConfig(input: CreateAkinatorDraftInput): Promise<AkinatorConfigDetail> {
    return apiClient.post<AkinatorConfigDetail>('/akinator/configs/draft', input);
  },

  /**
   * Updates metadata of a draft configuration.
   */
  async updateDraftMetadata(
    versionId: string,
    data: UpdateAkinatorDraftMetadataInput
  ): Promise<AkinatorConfigDetail> {
    return apiClient.patch<AkinatorConfigDetail>(
      `/akinator/configs/${encodeURIComponent(versionId)}`,
      data
    );
  },

  /**
   * Saves questions into a draft configuration.
   */
  async saveDraftQuestions(
    versionId: string,
    questions: AkinatorQuestionItem[]
  ): Promise<AkinatorConfigDetail> {
    return apiClient.put<AkinatorConfigDetail>(
      `/akinator/configs/${encodeURIComponent(versionId)}/questions`,
      { questions }
    );
  },

  /**
   * Saves rules into a draft configuration.
   */
  async saveDraftRules(
    versionId: string,
    rules: AkinatorRuleItem[]
  ): Promise<AkinatorConfigDetail> {
    return apiClient.put<AkinatorConfigDetail>(
      `/akinator/configs/${encodeURIComponent(versionId)}/rules`,
      { rules }
    );
  },

  /**
   * Validates configuration integrity before publishing.
   */
  async validateConfig(versionId: string): Promise<AkinatorValidationResult> {
    return apiClient.post<AkinatorValidationResult>(
      `/akinator/configs/${encodeURIComponent(versionId)}/validate`
    );
  },

  /**
   * Publishes a draft configuration version.
   */
  async publishConfig(
    versionId: string,
    changeLog?: string | null
  ): Promise<AkinatorConfigDetail> {
    return apiClient.post<AkinatorConfigDetail>(
      `/akinator/configs/${encodeURIComponent(versionId)}/publish`,
      { changeLog }
    );
  },

  // =========================================================================
  // ADMIN AKINATOR SESSIONS & WORKFLOW MANAGEMENT (PHASE 5)
  // =========================================================================

  /**
   * Fetches paginated Akinator quiz sessions with optional filters (Admin only).
   */
  async listSessions(filters?: AkinatorSessionListFilter): Promise<AkinatorSessionListResponse> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('pageSize', String(filters.pageSize));
    if (filters?.quizStatus) params.append('quizStatus', filters.quizStatus);
    if (filters?.workflowStatus) params.append('workflowStatus', filters.workflowStatus);
    if (filters?.evaluationStatus) params.append('evaluationStatus', filters.evaluationStatus);
    if (filters?.search?.trim()) params.append('search', filters.search.trim());
    if (filters?.fromDate?.trim()) params.append('fromDate', filters.fromDate.trim());
    if (filters?.toDate?.trim()) params.append('toDate', filters.toDate.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<AkinatorSessionListResponse>(`/akinator/sessions${queryString}`);
  },

  /**
   * Fetches full detail of an Akinator session including raw answers, evaluation result, admin review, and audit trail.
   */
  async getSessionDetail(id: string): Promise<AkinatorSessionDetail> {
    return apiClient.get<AkinatorSessionDetail>(`/akinator/sessions/${encodeURIComponent(id)}`);
  },

  /**
   * Updates Admin review data and notes for an Akinator session (strictly preserves raw answers).
   */
  async updateAdminReview(
    id: string,
    data: UpdateAkinatorReviewInput
  ): Promise<AkinatorAdminReviewItem> {
    return apiClient.patch<AkinatorAdminReviewItem>(
      `/akinator/sessions/${encodeURIComponent(id)}/review`,
      data
    );
  },

  /**
   * Transitions workflow status according to the approved state machine.
   */
  async transitionWorkflowStatus(
    id: string,
    input: TransitionAkinatorWorkflowInput
  ): Promise<any> {
    return apiClient.post(
      `/akinator/sessions/${encodeURIComponent(id)}/status`,
      input
    );
  },

  /**
   * Checks for existing customers in CRM matching the session's phone number.
   */
  async checkDuplicateCustomer(sessionId: string): Promise<CheckDuplicateCustomerResponse> {
    return apiClient.get<CheckDuplicateCustomerResponse>(
      `/akinator/sessions/${encodeURIComponent(sessionId)}/check-duplicate`
    );
  },

  /**
   * Transfers an APPROVED Akinator session into the CRM Customer tab:
   * - mode: 'LINK_EXISTING' (links to existing customer without overwriting)
   * - mode: 'CREATE_NEW' (creates new customer record with mapped fields)
   */
  async transferSession(
    sessionId: string,
    input: TransferAkinatorSessionInput
  ): Promise<TransferAkinatorSessionResponse> {
    return apiClient.post<TransferAkinatorSessionResponse>(
      `/akinator/sessions/${encodeURIComponent(sessionId)}/transfer`,
      input
    );
  },
};
