import { z } from 'zod';
import { RecommendationStatus } from '@prisma/client';

export const listRecommendationsQuerySchema = z.object({
  status: z.nativeEnum(RecommendationStatus).optional(),
  minScore: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined)),
  productId: z.string().optional(),
  customerId: z.string().optional(),
});

export const generateRecommendationsSchema = z.object({
  customerId: z.string().optional(),
});

export const convertToPushSchema = z.object({
  targetProductId: z.string().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export const recommendationIdParamSchema = z.object({
  id: z.string().min(1, 'Recommendation ID is required'),
});
