import { z } from 'zod';

export const createProductSchema = z.object({
  code: z.string().min(1, 'Product code is required').max(50),
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const productIdParamSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
});
