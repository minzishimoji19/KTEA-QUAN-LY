import apiClient from './apiClient';
import {
  OverviewResponse,
  CustomerAnalyticsResponse,
  CaseAnalyticsResponse,
  NeedAnalyticsResponse,
  PushAnalyticsResponse,
} from '../types/analytics';

export interface AnalyticsDateFilter {
  startDate?: string;
  endDate?: string;
}

function buildQuery(filter?: AnalyticsDateFilter): string {
  if (!filter) return '';
  const params = new URLSearchParams();
  if (filter.startDate) params.append('startDate', filter.startDate);
  if (filter.endDate) params.append('endDate', filter.endDate);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const analyticsService = {
  getOverview: async (filter?: AnalyticsDateFilter): Promise<OverviewResponse> => {
    return apiClient.get<OverviewResponse>(`/analytics/overview${buildQuery(filter)}`);
  },

  getCustomers: async (filter?: AnalyticsDateFilter): Promise<CustomerAnalyticsResponse> => {
    return apiClient.get<CustomerAnalyticsResponse>(`/analytics/customers${buildQuery(filter)}`);
  },

  getCases: async (filter?: AnalyticsDateFilter): Promise<CaseAnalyticsResponse> => {
    return apiClient.get<CaseAnalyticsResponse>(`/analytics/cases${buildQuery(filter)}`);
  },

  getNeeds: async (filter?: AnalyticsDateFilter): Promise<NeedAnalyticsResponse> => {
    return apiClient.get<NeedAnalyticsResponse>(`/analytics/needs${buildQuery(filter)}`);
  },

  getPush: async (filter?: AnalyticsDateFilter): Promise<PushAnalyticsResponse> => {
    return apiClient.get<PushAnalyticsResponse>(`/analytics/push${buildQuery(filter)}`);
  },
};

export default analyticsService;
