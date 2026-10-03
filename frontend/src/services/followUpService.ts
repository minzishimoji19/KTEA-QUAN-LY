import apiClient from './apiClient';
import { FollowUp, FollowUpStatus } from '../types/models';

export interface FollowUpQueryParams {
  filter?: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all';
  status?: FollowUpStatus;
  customerId?: string;
}

export const followUpService = {
  getFollowUps: async (params: FollowUpQueryParams = {}): Promise<FollowUp[]> => {
    const query = new URLSearchParams();
    if (params.filter) query.append('filter', params.filter);
    if (params.status) query.append('status', params.status);
    if (params.customerId) query.append('customerId', params.customerId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<FollowUp[]>(`/follow-ups${queryString}`);
  },

  createFollowUp: async (data: Partial<FollowUp>): Promise<FollowUp> => {
    return apiClient.post<FollowUp>('/follow-ups', data);
  },

  updateFollowUp: async (id: string, data: Partial<FollowUp>): Promise<FollowUp> => {
    return apiClient.patch<FollowUp>(`/follow-ups/${id}`, data);
  },

  deleteFollowUp: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/follow-ups/${id}`);
  },
};

export default followUpService;
