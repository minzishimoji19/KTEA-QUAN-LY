import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import customerSourceService from '../services/customerSourceService';

export const useCustomerSources = (activeOnly?: boolean) => {
  return useQuery({
    queryKey: ['customerSources', { activeOnly }],
    queryFn: () => customerSourceService.getAll(activeOnly),
  });
};

export const useCustomerSource = (id: string) => {
  return useQuery({
    queryKey: ['customerSources', id],
    queryFn: () => customerSourceService.getById(id),
    enabled: Boolean(id),
  });
};

export const useCreateCustomerSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; active?: boolean }) =>
      customerSourceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerSources'] });
    },
  });
};

export const useUpdateCustomerSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; active?: boolean } }) =>
      customerSourceService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerSources'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCustomerSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerSourceService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerSources'] });
    },
  });
};
