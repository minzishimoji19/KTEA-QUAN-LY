import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import caretakerService from '../services/caretakerService';

export const useCaretakers = (activeOnly?: boolean) => {
  return useQuery({
    queryKey: ['caretakers', { activeOnly }],
    queryFn: () => caretakerService.getAll(activeOnly),
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
    mutationFn: (data: { name: string; active?: boolean }) =>
      caretakerService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretakers'] });
    },
  });
};

export const useUpdateCaretaker = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; active?: boolean } }) =>
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
