import apiClient from './apiClient';
import { Caretaker } from '../types/models';

export const caretakerService = {
  getAll: async (activeOnly?: boolean): Promise<Caretaker[]> => {
    const query = activeOnly ? '?activeOnly=true' : '';
    return apiClient.get<Caretaker[]>(`/caretakers${query}`);
  },

  getById: async (id: string): Promise<Caretaker> => {
    return apiClient.get<Caretaker>(`/caretakers/${id}`);
  },

  create: async (data: { name: string; active?: boolean }): Promise<Caretaker> => {
    return apiClient.post<Caretaker>('/caretakers', data);
  },

  update: async (id: string, data: { name?: string; active?: boolean }): Promise<Caretaker> => {
    return apiClient.patch<Caretaker>(`/caretakers/${id}`, data);
  },

  delete: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/caretakers/${id}`);
  },
};

export default caretakerService;
