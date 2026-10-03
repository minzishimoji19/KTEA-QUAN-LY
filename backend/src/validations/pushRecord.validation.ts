import { z } from 'zod';
import { PushStatus } from '@prisma/client';

export const createPushRecordSchema = z.object({
  targetProductId: z.string().optional().nullable(),
  recommendationId: z.string().optional().nullable(),
  status: z.nativeEnum(PushStatus).optional().default(PushStatus.PENDING),
  note: z.string().max(2000).optional().nullable(),
});

export const updatePushRecordSchema = z.object({
  status: z.nativeEnum(PushStatus).optional(),
  resultAt: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable()),
  failureReason: z.string().max(1000).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const pushRecordIdParamSchema = z.object({
  id: z.string().min(1, 'Push Record ID is required'),
});
