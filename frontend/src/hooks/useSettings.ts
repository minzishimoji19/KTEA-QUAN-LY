import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import settingsService from '../services/settingsService';
import {
  GeneralSettings,
  NeedCategorySetting,
  StatusSetting,
  RecommendationSettings,
} from '../types/settings';

export const SETTINGS_QUERY_KEY = ['settings'] as const;
export const DATA_GOVERNANCE_QUERY_KEY = ['data-governance-status'] as const;

export const useSettings = () => {
  return useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => settingsService.getSettings(),
  });
};

export const useDataGovernanceStatus = () => {
  return useQuery({
    queryKey: DATA_GOVERNANCE_QUERY_KEY,
    queryFn: () => settingsService.getDataGovernanceStatus(),
    refetchInterval: 30000,
  });
};

export const useUpdateGeneralSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<GeneralSettings>) => settingsService.updateGeneral(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  });
};

export const useUpdateNeedCategories = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NeedCategorySetting[]) => settingsService.updateNeedCategories(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  });
};

export const useUpdateStatusSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StatusSetting[]) => settingsService.updateStatuses(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  });
};

export const useUpdateRecommendationSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<RecommendationSettings>) =>
      settingsService.updateRecommendationSettings(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, updated);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
    },
  });
};
