import apiClient from './apiClient';
import { CustomerNote } from '../types/models';

export const noteService = {
  getNotesByCustomer: async (customerId: string): Promise<CustomerNote[]> => {
    return apiClient.get<CustomerNote[]>(`/customers/${customerId}/notes`);
  },

  createNote: async (customerId: string, content: string): Promise<CustomerNote> => {
    return apiClient.post<CustomerNote>(`/customers/${customerId}/notes`, { content });
  },

  updateNote: async (id: string, content: string): Promise<CustomerNote> => {
    return apiClient.patch<CustomerNote>(`/notes/${id}`, { content });
  },

  deleteNote: async (id: string): Promise<{ id: string }> => {
    return apiClient.delete<{ id: string }>(`/notes/${id}`);
  },
};

export default noteService;
