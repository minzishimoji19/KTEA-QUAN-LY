import apiClient from './apiClient';
import { Tag } from '../types/models';

export interface CreateTagInput {
  name: string;
  color?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  color?: string | null;
}

export const tagService = {
  getTags: async (): Promise<Tag[]> => {
    return apiClient.get<Tag[]>('/tags');
  },

  createTag: async (data: CreateTagInput): Promise<Tag> => {
    return apiClient.post<Tag>('/tags', data);
  },

  updateTag: async (id: string, data: UpdateTagInput): Promise<Tag> => {
    return apiClient.patch<Tag>(`/tags/${id}`, data);
  },

  deleteTag: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/tags/${id}`);
  },
};

export default tagService;
