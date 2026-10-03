import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import caseService from '../services/caseService';
import { CustomerCase } from '../types/models';

export const useCases = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'cases'],
    queryFn: () => caseService.getCasesByCustomer(customerId),
    enabled: Boolean(customerId),
  });
};

export const useCreateCase = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CustomerCase>) => caseService.createCase(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCase = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerCase> }) =>
      caseService.updateCase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCase = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => caseService.deleteCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
