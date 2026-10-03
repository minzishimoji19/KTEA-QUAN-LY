import apiClient from './apiClient';
import { PushRecord, PushStatus } from '../types/models';

export const pushService = {
  getPushRecords: async (status?: PushStatus): Promise<PushRecord[]> => {
    return apiClient.get<PushRecord[]>(`/push-records${status ? `?status=${status}` : ''}`);
  },

  getCustomerPushRecords: async (customerId: string): Promise<PushRecord[]> => {
    return apiClient.get<PushRecord[]>(`/customers/${customerId}/push-records`);
  },

  createPushRecord: async (customerId: string, data: Partial<PushRecord>): Promise<PushRecord> => {
    return apiClient.post<PushRecord>(`/customers/${customerId}/push-records`, data);
  },

  updatePushRecord: async (id: string, data: Partial<PushRecord>): Promise<PushRecord> => {
    return apiClient.patch<PushRecord>(`/push-records/${id}`, data);
  },
};

export default pushService;
