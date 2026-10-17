import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import caretakerService from '../services/caretakerService';
import authService from '../services/authService';
import { AuthUser } from '../types/auth';

export const useCaretakers = (options?: boolean | { activeOnly?: boolean; forScheduling?: boolean }) => {
  const activeOnly = typeof options === 'boolean' ? options : options?.activeOnly;
  const forScheduling = typeof options === 'object' ? options?.forScheduling : false;

  return useQuery({
    queryKey: ['caretakers', { activeOnly, forScheduling }],
    queryFn: () => caretakerService.getAll(options),
  });
};

export const useAvailablePartners = () => {
  return useQuery({
    queryKey: ['caretakers', 'available-partners'],
    queryFn: () => caretakerService.getAvailablePartners(),
  });
};

export const useLinkCaretaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ caretakerId, userId }: { caretakerId: string; userId: string }) =>
      caretakerService.linkToUser(caretakerId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretakers'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useUnlinkCaretaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (caretakerId: string) => caretakerService.unlinkFromUser(caretakerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretakers'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

export const useCaretaker = (id: string) => {
  return useQuery({
    queryKey: ['caretakers', id],
    queryFn: () => caretakerService.getById(id),
    enabled: Boolean(id),
  });
};

export const useCreateCaretaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; active?: boolean; userId?: string | null }) =>
      caretakerService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretakers'] });
    },
  });
};

export const useUpdateCaretaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; active?: boolean; userId?: string | null } }) =>
      caretakerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretakers'] });
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
    },
  });
};

export const useDeleteCaretaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => caretakerService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretakers'] });
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
    },
  });
};

export const useEligibleCaregivers = () => {
  return useQuery<AuthUser[]>({
    queryKey: ['eligibleCaregivers'],
    queryFn: async () => {
      return authService.getEligibleCaregivers();
    },
  });
};


