import { z } from 'zod';
import { FollowUpStatus } from '@prisma/client';

export const listFollowUpsQuerySchema = z.object({
  filter: z.enum(['today', 'overdue', 'upcoming', 'completed', 'all']).optional().default('all'),
  status: z.nativeEnum(FollowUpStatus).optional(),
  customerId: z.string().optional(),
});

export const createFollowUpSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  status: z.nativeEnum(FollowUpStatus).optional().default(FollowUpStatus.PENDING),
});

export const updateFollowUpSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
  status: z.nativeEnum(FollowUpStatus).optional(),
  completedAt: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable()),
});

export const followUpIdParamSchema = z.object({
  id: z.string().min(1, 'Follow-up ID is required'),
});
