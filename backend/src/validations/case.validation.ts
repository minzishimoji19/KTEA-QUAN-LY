import { z } from 'zod';
import { CaseStatus } from '@prisma/client';

export const createCaseSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  caseStatus: z.nativeEnum(CaseStatus).optional().default(CaseStatus.DRAFT),
  applicationDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  resultDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  failureReason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCaseSchema = z.object({
  productId: z.string().optional(),
  caseStatus: z.nativeEnum(CaseStatus).optional(),
  applicationDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  resultDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  failureReason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const caseIdParamSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
});
