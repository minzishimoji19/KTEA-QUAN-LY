import apiClient from './apiClient';
import {
  Questionnaire,
  QuestionnaireVersion,
  QuestionDefinition,
  CreateQuestionnaireInput,
  UpdateQuestionnaireInput,
  CreateDraftVersionInput,
  PublishVersionInput,
  VersionValidationResult,
} from '../types/questionnaire';

export const questionnaireService = {
  getQuestionnaires: async (activeOnly = false): Promise<Questionnaire[]> => {
    return apiClient.get<Questionnaire[]>(`/questionnaires${activeOnly ? '?active=true' : ''}`);
  },

  getQuestionnaireById: async (id: string): Promise<Questionnaire> => {
    return apiClient.get<Questionnaire>(`/questionnaires/${id}`);
  },

  createQuestionnaire: async (data: CreateQuestionnaireInput): Promise<Questionnaire> => {
    return apiClient.post<Questionnaire>('/questionnaires', data);
  },

  updateQuestionnaire: async (id: string, data: UpdateQuestionnaireInput): Promise<Questionnaire> => {
    return apiClient.patch<Questionnaire>(`/questionnaires/${id}`, data);
  },

  deleteQuestionnaire: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/questionnaires/${id}`);
  },

  getVersionById: async (questionnaireId: string, versionId: string): Promise<QuestionnaireVersion> => {
    return apiClient.get<QuestionnaireVersion>(`/questionnaires/${questionnaireId}/versions/${versionId}`);
  },

  getCurrentPublishedVersion: async (questionnaireId: string): Promise<QuestionnaireVersion> => {
    return apiClient.get<QuestionnaireVersion>(`/questionnaires/${questionnaireId}/current`);
  },

  createDraftVersion: async (
    questionnaireId: string,
    data: CreateDraftVersionInput
  ): Promise<QuestionnaireVersion> => {
    return apiClient.post<QuestionnaireVersion>(`/questionnaires/${questionnaireId}/versions/draft`, data);
  },

  saveDraftQuestions: async (
    questionnaireId: string,
    versionId: string,
    questions: QuestionDefinition[]
  ): Promise<QuestionnaireVersion> => {
    return apiClient.put<QuestionnaireVersion>(
      `/questionnaires/${questionnaireId}/versions/${versionId}/questions`,
      { questions }
    );
  },

  reorderQuestions: async (
    questionnaireId: string,
    versionId: string,
    orders: Array<{ id: string; displayOrder: number }>
  ): Promise<QuestionDefinition[]> => {
    return apiClient.patch<QuestionDefinition[]>(
      `/questionnaires/${questionnaireId}/versions/${versionId}/reorder`,
      { orders }
    );
  },

  validateVersion: async (
    questionnaireId: string,
    versionId: string
  ): Promise<VersionValidationResult> => {
    return apiClient.post<VersionValidationResult>(
      `/questionnaires/${questionnaireId}/versions/${versionId}/validate`,
      {}
    );
  },

  publishVersion: async (
    questionnaireId: string,
    versionId: string,
    data: PublishVersionInput
  ): Promise<QuestionnaireVersion> => {
    return apiClient.post<QuestionnaireVersion>(
      `/questionnaires/${questionnaireId}/versions/${versionId}/publish`,
      data
    );
  },

  deleteDraftVersion: async (
    questionnaireId: string,
    versionId: string
  ): Promise<{ versionId: string }> => {
    return apiClient.delete<{ versionId: string }>(
      `/questionnaires/${questionnaireId}/versions/${versionId}`
    );
  },
};

export default questionnaireService;
