import { z } from 'zod';

export const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty').max(5000),
});

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content cannot be empty').max(5000),
});

export const noteIdParamSchema = z.object({
  id: z.string().min(1, 'Note ID is required'),
});
