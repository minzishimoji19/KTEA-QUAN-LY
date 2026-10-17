import apiClient from './apiClient';
import { FollowUp, FollowUpStatus } from '../types/models';

export interface FollowUpQueryParams {
  filter?: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all';
  status?: FollowUpStatus;
  customerId?: string;
  assignedTo?: string;
  assignedToUserId?: string;
}

export interface BulkOperationResult {
  total: number;
  succeeded: string[];
  failed: Array<{ id: string; reason: string }>;
}

export const followUpService = {
  getFollowUps: async (params: FollowUpQueryParams = {}): Promise<FollowUp[]> => {
    const query = new URLSearchParams();
    if (params.filter) query.append('filter', params.filter);
    if (params.status) query.append('status', params.status);
    if (params.customerId) query.append('customerId', params.customerId);
    if (params.assignedTo) query.append('assignedTo', params.assignedTo);
    if (params.assignedToUserId) query.append('assignedToUserId', params.assignedToUserId);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<FollowUp[]>(`/follow-ups${queryString}`);
  },

  createFollowUp: async (data: Partial<FollowUp>): Promise<FollowUp> => {
    return apiClient.post<FollowUp>('/follow-ups', data);
  },

  createBulkFollowUps: async (data: {
    customerIds: string[];
    title: string;
    description?: string | null;
    dueAt: string;
    status?: FollowUpStatus;
    assignedTo?: string | null;
    assignedToUserId?: string | null;
  }): Promise<{ count: number; followUps: FollowUp[] }> => {
    return apiClient.post<{ count: number; followUps: FollowUp[] }>('/follow-ups/bulk', data);
  },

  completeBulkFollowUps: async (ids: string[]): Promise<BulkOperationResult> => {
    return apiClient.post<BulkOperationResult>('/follow-ups/bulk-complete', { ids });
  },

  deleteBulkFollowUps: async (ids: string[]): Promise<BulkOperationResult> => {
    return apiClient.post<BulkOperationResult>('/follow-ups/bulk-delete', { ids });
  },

  updateFollowUp: async (id: string, data: Partial<FollowUp>): Promise<FollowUp> => {
    return apiClient.patch<FollowUp>(`/follow-ups/${id}`, data);
  },

  deleteFollowUp: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/follow-ups/${id}`);
  },
};

export default followUpService;
