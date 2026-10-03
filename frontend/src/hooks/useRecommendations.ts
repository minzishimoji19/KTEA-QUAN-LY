import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import recommendationService, {
  RecommendationFilters,
} from '../services/recommendationService';

export const useRecommendations = (filters?: RecommendationFilters) => {
  return useQuery({
    queryKey: ['recommendations', filters],
    queryFn: () => recommendationService.getRecommendations(filters),
  });
};

export const useCustomerRecommendations = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'recommendations'],
    queryFn: () => recommendationService.getCustomerRecommendations(customerId),
    enabled: Boolean(customerId),
  });
};

export const useGenerateRecommendations = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId?: string) =>
      recommendationService.generateRecommendations(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useReviewRecommendation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recommendationService.reviewRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useDismissRecommendation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recommendationService.dismissRecommendation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useConvertToPush = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { targetProductId?: string | null; note?: string | null };
    }) => recommendationService.convertToPush(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['push-records'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};
