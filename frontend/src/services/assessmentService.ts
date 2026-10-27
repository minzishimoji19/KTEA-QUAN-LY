import apiClient from './apiClient';
import {
  Assessment,
  CreateAssessmentInput,
  SaveAssessmentAnswersInput,
} from '../types/assessment';

export const assessmentService = {
  getAssessmentsByCustomer: async (customerId: string): Promise<Assessment[]> => {
    return apiClient.get<Assessment[]>(`/customers/${customerId}/assessments`);
  },

  startAssessment: async (
    customerId: string,
    data: CreateAssessmentInput
  ): Promise<Assessment> => {
    return apiClient.post<Assessment>(`/customers/${customerId}/assessments`, data);
  },

  getAssessmentById: async (assessmentId: string): Promise<Assessment> => {
    return apiClient.get<Assessment>(`/assessments/${assessmentId}`);
  },

  saveAnswers: async (
    assessmentId: string,
    data: SaveAssessmentAnswersInput
  ): Promise<Assessment> => {
    return apiClient.put<Assessment>(`/assessments/${assessmentId}/answers`, data);
  },

  completeAssessment: async (
    assessmentId: string,
    data?: Partial<SaveAssessmentAnswersInput>
  ): Promise<Assessment> => {
    return apiClient.post<Assessment>(`/assessments/${assessmentId}/complete`, data || {});
  },

  cancelAssessment: async (assessmentId: string): Promise<{ assessmentId: string }> => {
    return apiClient.post<{ assessmentId: string }>(`/assessments/${assessmentId}/cancel`, {});
  },
};

export default assessmentService;
