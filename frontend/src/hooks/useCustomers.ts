import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import customerService, { CustomerQueryParams } from '../services/customerService';
import { CustomerDetail } from '../types/models';

export const useCustomers = (params: CustomerQueryParams = {}) => {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => customerService.getCustomers(params),
  });
};

export const useCustomerDetail = (id: string | undefined) => {
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => customerService.getCustomerDetail(id!),
    enabled: Boolean(id),
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CustomerDetail>) => customerService.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = (id?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, data }: { customerId?: string; data: Partial<CustomerDetail> }) => {
      const targetId = customerId || id;
      if (!targetId) throw new Error('Customer ID is required');
      return customerService.updateCustomer(targetId, data);
    },
    onSuccess: (_result, variables) => {
      const targetId = variables.customerId || id;
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: ['customers', 'detail', targetId] });
      }
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerService.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useAddCustomerTag = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => customerService.addTag(customerId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useRemoveCustomerTag = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => customerService.removeTag(customerId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
