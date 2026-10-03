import { z } from 'zod';
import { NeedStatus } from '@prisma/client';

export const createNeedSchema = z.object({
  needType: z.string().min(1, 'Need type is required').max(100),
  status: z.nativeEnum(NeedStatus).optional().default(NeedStatus.OPEN),
  detectedAt: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  resolvedAt: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateNeedSchema = createNeedSchema.partial();

export const needIdParamSchema = z.object({
  id: z.string().min(1, 'Need ID is required'),
});
