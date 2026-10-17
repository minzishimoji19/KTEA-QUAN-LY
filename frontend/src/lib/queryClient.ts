import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '../services/apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      retry: (failureCount, error) => {
        // Never retry unauthorized (401) or forbidden (403) errors to avoid request loops
        if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default queryClient;
