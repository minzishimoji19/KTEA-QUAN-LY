import { z } from 'zod';

export const createCustomerSourceSchema = z.object({
  name: z.string().trim().min(1, 'Source name is required').max(100, 'Source name cannot exceed 100 characters'),
  active: z.boolean().optional().default(true),
});

export const updateCustomerSourceSchema = z.object({
  name: z.string().trim().min(1, 'Source name cannot be empty').max(100, 'Source name cannot exceed 100 characters').optional(),
  active: z.boolean().optional(),
});

export const customerSourceIdParamSchema = z.object({
  id: z.string().min(1, 'Customer source ID is required'),
});

export const listCustomerSourcesQuerySchema = z.object({
  activeOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});
