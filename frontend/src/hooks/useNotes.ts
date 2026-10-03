import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import noteService from '../services/noteService';

export const useNotes = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'notes'],
    queryFn: () => noteService.getNotesByCustomer(customerId),
    enabled: Boolean(customerId),
  });
};

export const useCreateNote = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => noteService.createNote(customerId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateNote = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      noteService.updateNote(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
    },
  });
};

export const useDeleteNote = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noteService.deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
    },
  });
};
