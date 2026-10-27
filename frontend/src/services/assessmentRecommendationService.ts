import apiClient from './apiClient';
import {
  AssessmentRecommendationRun,
  RunRecommendationInput,
} from '../types/assessmentRecommendation';

export const assessmentRecommendationService = {
  // Run recommendations for a completed assessment
  generateForAssessment: async (
    assessmentId: string,
    data?: RunRecommendationInput
  ): Promise<AssessmentRecommendationRun> => {
    return apiClient.post<AssessmentRecommendationRun>(
      `/assessments/${assessmentId}/recommendations`,
      data || {}
    );
  },

  // Get historical runs for a customer
  getRunsByCustomer: async (
    customerId: string
  ): Promise<AssessmentRecommendationRun[]> => {
    return apiClient.get<AssessmentRecommendationRun[]>(
      `/customers/${customerId}/recommendation-runs`
    );
  },

  // Get historical runs for a specific assessment
  getRunsByAssessment: async (
    assessmentId: string
  ): Promise<AssessmentRecommendationRun[]> => {
    return apiClient.get<AssessmentRecommendationRun[]>(
      `/assessments/${assessmentId}/recommendation-runs`
    );
  },

  // Get single run detail with items and frozen snapshots
  getRunById: async (
    runId: string
  ): Promise<AssessmentRecommendationRun> => {
    return apiClient.get<AssessmentRecommendationRun>(
      `/recommendation-runs/${runId}`
    );
  },

  // Admin: List all rule sets
  getAllRuleSets: async (): Promise<any[]> => {
    return apiClient.get<any[]>('/recommendation-rules');
  },

  // Admin: Update draft rule version
  updateRuleVersion: async (
    versionId: string,
    data: {
      description?: string;
      rulesDefinition?: any;
      effectiveFrom?: string;
      effectiveTo?: string;
    }
  ): Promise<any> => {
    return apiClient.put<any>(`/recommendation-rules/versions/${versionId}`, data);
  },

  // Admin: Simulate recommendation with test answers against a rule version
  simulateRecommendations: async (
    versionId: string,
    answers: Record<string, any>
  ): Promise<any> => {
    return apiClient.post<any>(`/recommendation-rules/versions/${versionId}/simulate`, {
      answers,
    });
  },
};

export default assessmentRecommendationService;
