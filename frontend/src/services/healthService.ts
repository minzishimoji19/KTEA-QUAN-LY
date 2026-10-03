import { apiClient } from './apiClient';
import { HealthStatus } from '../types/api';

export const healthService = {
  checkHealth: async (): Promise<HealthStatus> => {
    return apiClient.get<HealthStatus>('/health');
  },
};

export default healthService;
