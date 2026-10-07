import apiClient, { getApiBaseUrl } from './apiClient';
import { CustomerSummary, CustomerDetail } from '../types/models';
import { PaginatedResponse } from '../types/api';

export interface CustomerQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  priority?: string;
  sourceId?: string;
  product?: string;
  need?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const customerService = {
  getCustomers: async (params: CustomerQueryParams = {}): Promise<PaginatedResponse<CustomerSummary>> => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('pageSize', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.priority) query.append('priority', params.priority);
    if (params.sourceId) query.append('sourceId', params.sourceId);
    if (params.product) query.append('product', params.product);
    if (params.need) query.append('need', params.need);
    if (params.tag) query.append('tag', params.tag);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${getApiBaseUrl()}/customers${queryString}`);
    if (!res.ok) {
      throw new Error(`Failed to load customers (${res.status})`);
    }
    return res.json();
  },

  getCustomerDetail: async (id: string): Promise<CustomerDetail> => {
    return apiClient.get<CustomerDetail>(`/customers/${id}`);
  },

  createCustomer: async (data: Partial<CustomerDetail>): Promise<CustomerDetail> => {
    return apiClient.post<CustomerDetail>('/customers', data);
  },

  updateCustomer: async (id: string, data: Partial<CustomerDetail>): Promise<CustomerDetail> => {
    return apiClient.patch<CustomerDetail>(`/customers/${id}`, data);
  },

  deleteCustomer: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/customers/${id}`);
  },

  addTag: async (customerId: string, tagId: string): Promise<{ customerId: string; tagId: string }> => {
    return apiClient.post<{ customerId: string; tagId: string }>(`/customers/${customerId}/tags/${tagId}`);
  },

  removeTag: async (customerId: string, tagId: string): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/customers/${customerId}/tags/${tagId}`);
  },

  executeBulkAction: async (
    data: import('../types/models').BulkActionRequest
  ): Promise<{ affected: number; action: string; customerIds: string[] }> => {
    return apiClient.post<{ affected: number; action: string; customerIds: string[] }>(
      '/customers/bulk-action',
      data
    );
  },
};

export default customerService;
