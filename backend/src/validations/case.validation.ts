import { z } from 'zod';
import { CaseStatus, CaseProgress } from '@prisma/client';

export const createCaseSchema = z.object({
  productId: z.string().optional().nullable(),
  caseStatus: z.nativeEnum(CaseStatus).optional().default(CaseStatus.ACTIVE),
  progress: z.nativeEnum(CaseProgress).optional().default(CaseProgress.NOT_SELECTED),
  applicationDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  resultDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  failureReason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateCaseSchema = z.object({
  productId: z.string().optional().nullable(),
  caseStatus: z.nativeEnum(CaseStatus).optional(),
  progress: z.nativeEnum(CaseProgress).optional(),
  applicationDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  resultDate: z.string().datetime().optional().nullable().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()),
  failureReason: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const selectProductSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

export const updateProgressSchema = z.object({
  toProgress: z.nativeEnum(CaseProgress),
  note: z.string().max(2000).optional().nullable(),
});

export const rejectCaseSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
  note: z.string().max(2000).optional().nullable(),
});

export const caseIdParamSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
});

