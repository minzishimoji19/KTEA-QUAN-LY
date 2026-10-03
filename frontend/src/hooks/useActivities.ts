import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import activityService, { CreateActivityPayload } from '../services/activityService';

export const useActivities = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'activities'],
    queryFn: () => activityService.getActivitiesByCustomer(customerId),
    enabled: Boolean(customerId),
  });
};

export const useCreateActivity = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActivityPayload) =>
      activityService.createActivity(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
