import apiClient from './apiClient';
import { Caretaker, AvailablePartner } from '../types/models';

export const caretakerService = {
  getAll: async (options?: boolean | { activeOnly?: boolean; forScheduling?: boolean }): Promise<Caretaker[]> => {
    const params = new URLSearchParams();
    const activeOnly = typeof options === 'boolean' ? options : options?.activeOnly;
    const forScheduling = typeof options === 'object' ? options?.forScheduling : false;

    if (activeOnly) params.append('activeOnly', 'true');
    if (forScheduling) params.append('forScheduling', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<Caretaker[]>(`/caretakers${query}`);
  },

  getAvailablePartners: async (): Promise<AvailablePartner[]> => {
    return apiClient.get<AvailablePartner[]>('/caretakers/available-partners');
  },

  linkToUser: async (caretakerId: string, userId: string): Promise<Caretaker> => {
    return apiClient.post<Caretaker>(`/caretakers/${caretakerId}/link`, { userId });
  },

  unlinkFromUser: async (caretakerId: string): Promise<Caretaker> => {
    return apiClient.post<Caretaker>(`/caretakers/${caretakerId}/unlink`, {});
  },

  getById: async (id: string): Promise<Caretaker> => {
    return apiClient.get<Caretaker>(`/caretakers/${id}`);
  },

  create: async (data: { name: string; active?: boolean; userId?: string | null }): Promise<Caretaker> => {
    return apiClient.post<Caretaker>('/caretakers', data);
  },

  update: async (id: string, data: { name?: string; active?: boolean; userId?: string | null }): Promise<Caretaker> => {
    return apiClient.patch<Caretaker>(`/caretakers/${id}`, data);
  },

  delete: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/caretakers/${id}`);
  },
};

export default caretakerService;

