import apiClient from './apiClient';
import { CustomerNeed } from '../types/models';

export const needService = {
  getNeedsByCustomer: async (customerId: string): Promise<CustomerNeed[]> => {
    return apiClient.get<CustomerNeed[]>(`/customers/${customerId}/needs`);
  },

  createNeed: async (customerId: string, data: Partial<CustomerNeed>): Promise<CustomerNeed> => {
    return apiClient.post<CustomerNeed>(`/customers/${customerId}/needs`, data);
  },

  updateNeed: async (id: string, data: Partial<CustomerNeed>): Promise<CustomerNeed> => {
    return apiClient.patch<CustomerNeed>(`/needs/${id}`, data);
  },

  deleteNeed: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/needs/${id}`);
  },
};

export default needService;
