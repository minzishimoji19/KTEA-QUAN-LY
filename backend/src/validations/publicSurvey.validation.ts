/**
 * publicSurvey.validation.ts
 * Zod schemas for public survey link API endpoints.
 */
import { z } from 'zod';

export const createPublicSurveyLinkSchema = z
  .object({
    questionnaireId: z.string().uuid('ID bộ câu hỏi không hợp lệ').optional(),
    questionnaireVersionId: z.string().uuid('ID phiên bản không hợp lệ').optional(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) => Boolean(d.questionnaireId || d.questionnaireVersionId),
    'Phải cung cấp questionnaireId hoặc questionnaireVersionId'
  );

export const publicSurveyTokenParamSchema = z.object({
  token: z.string().min(1, 'Token không hợp lệ').max(128, 'Token quá dài'),
});

export const publicSaveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionCode: z.string().min(1),
        questionId: z.string().uuid().optional().nullable(),
        answerValue: z.any(),
      })
    )
    .max(500, 'Quá nhiều câu trả lời trong một request'),
});

export const publicCompleteSchema = z.object({
  answers: z
    .array(
      z.object({
        questionCode: z.string().min(1),
        questionId: z.string().uuid().optional().nullable(),
        answerValue: z.any(),
      })
    )
    .optional(),
});

export const linkIdParamSchema = z.object({
  linkId: z.string().uuid('Link ID không hợp lệ'),
});

export const customerIdParamSchema = z.object({
  customerId: z.string().uuid('Customer ID không hợp lệ'),
});
