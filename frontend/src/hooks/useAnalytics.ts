import { useQuery } from '@tanstack/react-query';
import analyticsService, { AnalyticsDateFilter } from '../services/analyticsService';

export const useAnalyticsOverview = (filter?: AnalyticsDateFilter) => {
  return useQuery({
    queryKey: ['analytics', 'overview', filter],
    queryFn: () => analyticsService.getOverview(filter),
  });
};

export const useCustomerAnalytics = (filter?: AnalyticsDateFilter) => {
  return useQuery({
    queryKey: ['analytics', 'customers', filter],
    queryFn: () => analyticsService.getCustomers(filter),
  });
};

export const useCaseAnalytics = (filter?: AnalyticsDateFilter) => {
  return useQuery({
    queryKey: ['analytics', 'cases', filter],
    queryFn: () => analyticsService.getCases(filter),
  });
};

export const useNeedAnalytics = (filter?: AnalyticsDateFilter) => {
  return useQuery({
    queryKey: ['analytics', 'needs', filter],
    queryFn: () => analyticsService.getNeeds(filter),
  });
};

export const usePushAnalytics = (filter?: AnalyticsDateFilter) => {
  return useQuery({
    queryKey: ['analytics', 'push', filter],
    queryFn: () => analyticsService.getPush(filter),
  });
};
