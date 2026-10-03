import apiClient from './apiClient';
import { CustomerCase } from '../types/models';

export const caseService = {
  getCasesByCustomer: async (customerId: string): Promise<CustomerCase[]> => {
    return apiClient.get<CustomerCase[]>(`/customers/${customerId}/cases`);
  },

  createCase: async (customerId: string, data: Partial<CustomerCase>): Promise<CustomerCase> => {
    return apiClient.post<CustomerCase>(`/customers/${customerId}/cases`, data);
  },

  updateCase: async (id: string, data: Partial<CustomerCase>): Promise<CustomerCase> => {
    return apiClient.patch<CustomerCase>(`/cases/${id}`, data);
  },

  deleteCase: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/cases/${id}`);
  },
};

export default caseService;
