import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import pushService from '../services/pushService';
import { PushRecord, PushStatus } from '../types/models';

export const usePushRecords = (status?: PushStatus) => {
  return useQuery({
    queryKey: ['push-records', { status }],
    queryFn: () => pushService.getPushRecords(status),
  });
};

export const useCustomerPushRecords = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'push-records'],
    queryFn: () => pushService.getCustomerPushRecords(customerId),
    enabled: Boolean(customerId),
  });
};

export const useCreatePushRecord = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PushRecord>) => pushService.createPushRecord(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-records'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdatePushRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PushRecord> }) =>
      pushService.updatePushRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-records'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
