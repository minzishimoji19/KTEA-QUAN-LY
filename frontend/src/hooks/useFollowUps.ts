import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import followUpService, { FollowUpQueryParams } from '../services/followUpService';
import { FollowUp } from '../types/models';

export const useFollowUps = (params: FollowUpQueryParams = {}) => {
  return useQuery({
    queryKey: ['follow-ups', params],
    queryFn: () => followUpService.getFollowUps(params),
  });
};

export const useCreateFollowUp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FollowUp>) => followUpService.createFollowUp(data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ['customers', 'detail', variables.customerId] });
      }
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateFollowUp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FollowUp> }) =>
      followUpService.updateFollowUp(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteFollowUp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => followUpService.deleteFollowUp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
