import { z } from 'zod';

export const analyticsFilterQuerySchema = z.object({
  startDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  endDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export type AnalyticsFilterQuery = z.infer<typeof analyticsFilterQuerySchema>;
