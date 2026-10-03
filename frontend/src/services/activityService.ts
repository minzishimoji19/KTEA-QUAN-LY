import apiClient from './apiClient';
import { CustomerActivity, ActivityType } from '../types/models';

export interface CreateActivityPayload {
  type: ActivityType;
  title: string;
  description?: string | null;
  occurredAt?: string;
}

export const activityService = {
  getActivitiesByCustomer: async (customerId: string): Promise<CustomerActivity[]> => {
    return apiClient.get<CustomerActivity[]>(`/customers/${customerId}/activities`);
  },

  createActivity: async (
    customerId: string,
    data: CreateActivityPayload
  ): Promise<CustomerActivity> => {
    return apiClient.post<CustomerActivity>(`/customers/${customerId}/activities`, data);
  },
};

export default activityService;
