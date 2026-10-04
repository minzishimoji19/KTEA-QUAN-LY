import apiClient from './apiClient';
import { CustomerCase, CaseProgress } from '../types/models';

export const caseService = {
  getCasesByCustomer: async (customerId: string): Promise<CustomerCase[]> => {
    return apiClient.get<CustomerCase[]>(`/customers/${customerId}/cases`);
  },

  getCaseById: async (id: string): Promise<CustomerCase> => {
    return apiClient.get<CustomerCase>(`/cases/${id}`);
  },

  createCase: async (customerId: string, data: Partial<CustomerCase>): Promise<CustomerCase> => {
    return apiClient.post<CustomerCase>(`/customers/${customerId}/cases`, data);
  },

  selectProduct: async (id: string, productId: string): Promise<CustomerCase> => {
    return apiClient.patch<CustomerCase>(`/cases/${id}/product`, { productId });
  },

  updateProgress: async (
    id: string,
    data: { toProgress: CaseProgress; note?: string | null }
  ): Promise<CustomerCase> => {
    return apiClient.patch<CustomerCase>(`/cases/${id}/progress`, data);
  },

  rejectCase: async (
    id: string,
    data: { reason: string; note?: string | null }
  ): Promise<CustomerCase> => {
    return apiClient.post<CustomerCase>(`/cases/${id}/reject`, data);
  },

  updateCase: async (id: string, data: Partial<CustomerCase>): Promise<CustomerCase> => {
    return apiClient.patch<CustomerCase>(`/cases/${id}`, data);
  },

  deleteCase: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/cases/${id}`);
  },
};

export default caseService;
