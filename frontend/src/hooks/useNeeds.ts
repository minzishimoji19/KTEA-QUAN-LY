import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import needService from '../services/needService';
import { CustomerNeed } from '../types/models';

export const useNeeds = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'needs'],
    queryFn: () => needService.getNeedsByCustomer(customerId),
    enabled: Boolean(customerId),
  });
};

export const useCreateNeed = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CustomerNeed>) => needService.createNeed(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'needs'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateNeed = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerNeed> }) =>
      needService.updateNeed(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'needs'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteNeed = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => needService.deleteNeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'needs'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
