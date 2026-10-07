import { z } from 'zod';
import { CustomerStatus, PriorityLevel } from '@prisma/client';

export const bulkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('UPDATE_STATUS'),
    customerIds: z.array(z.string().min(1)).min(1, 'At least one customer ID is required'),
    payload: z.object({
      status: z.nativeEnum(CustomerStatus),
    }),
  }),
  z.object({
    action: z.literal('UPDATE_PRIORITY'),
    customerIds: z.array(z.string().min(1)).min(1, 'At least one customer ID is required'),
    payload: z.object({
      priority: z.nativeEnum(PriorityLevel),
    }),
  }),
  z.object({
    action: z.literal('ADD_TAG'),
    customerIds: z.array(z.string().min(1)).min(1, 'At least one customer ID is required'),
    payload: z.object({
      tagId: z.string().min(1, 'Tag ID is required'),
    }),
  }),
]);

export type BulkActionInput = z.infer<typeof bulkActionSchema>;
