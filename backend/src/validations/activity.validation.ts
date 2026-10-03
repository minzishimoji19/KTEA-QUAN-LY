import { z } from 'zod';
import { ActivityType } from '@prisma/client';

export const createActivitySchema = z.object({
  type: z.nativeEnum(ActivityType),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  occurredAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});
