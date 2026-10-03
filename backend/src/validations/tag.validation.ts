import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z.string().max(20).optional().nullable(),
});

export const updateTagSchema = createTagSchema.partial();

export const tagIdParamSchema = z.object({
  id: z.string().min(1, 'Tag ID is required'),
});
