import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import { DashboardData } from '../types/dashboard';

export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

export const useDashboard = (options?: { enabled?: boolean }) => {
  const isEnabled = options?.enabled ?? true;
  return useQuery<DashboardData>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardService.getDashboardData(),
    enabled: isEnabled,
    refetchInterval: isEnabled ? 60000 : false,
    staleTime: 15000,
  });
};
