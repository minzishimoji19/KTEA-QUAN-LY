import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { DashboardData } from '../types/dashboard';

export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

export const useDashboard = () => {
  return useQuery<DashboardData>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardService.getDashboardData(),
    refetchInterval: 60000,
    staleTime: 15000,
  });
};
