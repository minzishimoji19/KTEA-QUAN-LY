import apiClient from './apiClient';
import { DashboardData } from '../types/dashboard';

export const dashboardService = {
  getDashboardData: async (): Promise<DashboardData> => {
    return apiClient.get<DashboardData>('/dashboard');
  },
};

export default dashboardService;
