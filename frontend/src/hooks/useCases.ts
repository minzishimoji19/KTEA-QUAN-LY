import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import caseService from '../services/caseService';
import { CustomerCase, CaseProgress } from '../types/models';

export const useCases = (customerId: string) => {
  return useQuery({
    queryKey: ['customers', customerId, 'cases'],
    queryFn: () => caseService.getCasesByCustomer(customerId),
    enabled: Boolean(customerId),
  });
};

export const useCase = (caseId: string) => {
  return useQuery({
    queryKey: ['cases', caseId],
    queryFn: () => caseService.getCaseById(caseId),
    enabled: Boolean(caseId),
  });
};

export const useCreateCase = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CustomerCase>) => caseService.createCase(customerId, data),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (newCase?.id) {
        queryClient.setQueryData(['cases', newCase.id], newCase);
      }
    },
  });
};

export const useSelectProduct = (customerId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, productId }: { id: string; productId: string }) =>
      caseService.selectProduct(id, productId),
    onSuccess: (updatedCase) => {
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
        queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
        queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      }
      queryClient.invalidateQueries({ queryKey: ['cases', updatedCase.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateProgress = (customerId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      toProgress,
      note,
    }: {
      id: string;
      toProgress: CaseProgress;
      note?: string | null;
    }) => caseService.updateProgress(id, { toProgress, note }),
    onSuccess: (updatedCase) => {
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
        queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
        queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      }
      queryClient.invalidateQueries({ queryKey: ['cases', updatedCase.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useRejectCase = (customerId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      note,
    }: {
      id: string;
      reason: string;
      note?: string | null;
    }) => caseService.rejectCase(id, { reason, note }),
    onSuccess: (rejectedCase) => {
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
        queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
        queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      }
      queryClient.invalidateQueries({ queryKey: ['cases', rejectedCase.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCase = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerCase> }) =>
      caseService.updateCase(id, data),
    onSuccess: (updatedCase) => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['cases', updatedCase.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useDeleteCase = (customerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => caseService.deleteCase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'cases'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers', customerId, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
