import apiClient from './apiClient';
import { Recommendation, RecommendationStatus, PushRecord } from '../types/models';

export interface RecommendationFilters {
  status?: RecommendationStatus;
  minScore?: number;
  productId?: string;
  customerId?: string;
}

export const recommendationService = {
  getRecommendations: async (filters?: RecommendationFilters): Promise<Recommendation[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.minScore !== undefined) params.append('minScore', String(filters.minScore));
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.customerId) params.append('customerId', filters.customerId);

    const query = params.toString();
    return apiClient.get<Recommendation[]>(`/recommendations${query ? `?${query}` : ''}`);
  },

  getRecommendationById: async (id: string): Promise<Recommendation> => {
    return apiClient.get<Recommendation>(`/recommendations/${id}`);
  },

  getCustomerRecommendations: async (customerId: string): Promise<Recommendation[]> => {
    return apiClient.get<Recommendation[]>(`/customers/${customerId}/recommendations`);
  },

  generateRecommendations: async (customerId?: string): Promise<{ generatedCount: number; recommendations: Recommendation[] }> => {
    return apiClient.post<{ generatedCount: number; recommendations: Recommendation[] }>(
      '/recommendations/generate',
      { customerId }
    );
  },

  reviewRecommendation: async (id: string): Promise<Recommendation> => {
    return apiClient.patch<Recommendation>(`/recommendations/${id}/review`);
  },

  dismissRecommendation: async (id: string): Promise<Recommendation> => {
    return apiClient.patch<Recommendation>(`/recommendations/${id}/dismiss`);
  },

  convertToPush: async (
    id: string,
    data: {
      targetProductId?: string | null;
      note?: string | null;
    }
  ): Promise<PushRecord> => {
    return apiClient.post<PushRecord>(`/recommendations/${id}/push`, data);
  },
};

export default recommendationService;
