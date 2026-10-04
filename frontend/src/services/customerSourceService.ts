import apiClient from './apiClient';
import { CustomerSource } from '../types/models';

export const customerSourceService = {
  getAll: async (activeOnly?: boolean): Promise<CustomerSource[]> => {
    const query = activeOnly ? '?activeOnly=true' : '';
    return apiClient.get<CustomerSource[]>(`/customer-sources${query}`);
  },

  getById: async (id: string): Promise<CustomerSource> => {
    return apiClient.get<CustomerSource>(`/customer-sources/${id}`);
  },

  create: async (data: { name: string; active?: boolean }): Promise<CustomerSource> => {
    return apiClient.post<CustomerSource>('/customer-sources', data);
  },

  update: async (id: string, data: { name?: string; active?: boolean }): Promise<CustomerSource> => {
    return apiClient.patch<CustomerSource>(`/customer-sources/${id}`, data);
  },

  delete: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/customer-sources/${id}`);
  },
};

export default customerSourceService;
