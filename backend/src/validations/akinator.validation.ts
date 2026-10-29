import { z } from 'zod';
import {
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorQuizStatus,
  AkinatorWorkflowStatus,
  AkinatorEvaluationStatus,
  Gender,
  PriorityLevel,
} from '@prisma/client';
import { parseStrictDateOnly } from '../utils/dateUtils.js';

export const akinatorConditionOperatorSchema = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'CONTAINS',
  'IS_ANSWERED',
  'IS_NOT_ANSWERED',
]);

export const akinatorSingleConditionSchema = z.object({
  questionCode: z
    .string()
    .trim()
    .min(1, 'Mã câu hỏi trong điều kiện không được để trống')
    .max(100),
  operator: akinatorConditionOperatorSchema,
  value: z.any().optional(),
});

export const akinatorConditionGroupSchema = z.object({
  logic: z.enum(['AND', 'OR']).default('AND'),
  conditions: z.array(akinatorSingleConditionSchema).min(1, 'Phải có ít nhất 1 điều kiện'),
});

export const akinatorNextQuestionRuleSchema = z
  .object({
    logic: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(akinatorSingleConditionSchema).min(1, 'Quy tắc rẽ nhánh phải có ít nhất 1 điều kiện'),
    action: z.enum(['GOTO_QUESTION', 'END_QUIZ']),
    targetQuestionCode: z.string().trim().max(100).nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'GOTO_QUESTION' && (!val.targetQuestionCode || !val.targetQuestionCode.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetQuestionCode'],
        message: 'Cần chỉ định mã câu hỏi đích (targetQuestionCode) khi action là GOTO_QUESTION',
      });
    }
  });

export const akinatorQuestionOptionSchema = z.object({
  value: z.string().trim().min(1, 'Giá trị lựa chọn không được để trống').max(200),
  label: z.string().trim().min(1, 'Nhãn hiển thị không được để trống').max(500),
  description: z.string().trim().max(500).nullable().optional(),
});

export const akinatorQuestionInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Mã câu hỏi phải có ít nhất 2 ký tự')
      .max(100, 'Mã câu hỏi tối đa 100 ký tự')
      .regex(/^[A-Za-z0-9_]+$/, 'Mã câu hỏi chỉ chứa chữ cái, số và dấu gạch dưới'),
    questionText: z
      .string()
      .trim()
      .min(3, 'Nội dung câu hỏi phải có ít nhất 3 ký tự')
      .max(2000, 'Nội dung câu hỏi tối đa 2000 ký tự'),
    description: z.string().trim().max(2000).nullable().optional(),
    questionType: z.nativeEnum(AkinatorQuestionType),
    isEntryQuestion: z.boolean().default(false),
    isRequiredForEval: z.boolean().default(false),
    priorityWeight: z.number().int().min(0).max(1000).default(50),
    mapsToCustomerField: z
      .nativeEnum(AkinatorCustomerFieldMapping)
      .default(AkinatorCustomerFieldMapping.NONE),
    options: z.array(akinatorQuestionOptionSchema).nullable().optional(),
    validationConfig: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
        minLength: z.number().int().min(0).optional(),
        maxLength: z.number().int().min(1).optional(),
        pattern: z.string().max(500).optional(),
        minDate: z.string().optional(),
        maxDate: z.string().optional(),
      })
      .nullable()
      .optional(),
    visibilityConditions: akinatorConditionGroupSchema.nullable().optional(),
    nextQuestionRules: z.array(akinatorNextQuestionRuleSchema).nullable().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((q, ctx) => {
    if (
      q.questionType === AkinatorQuestionType.SINGLE_CHOICE ||
      q.questionType === AkinatorQuestionType.MULTIPLE_CHOICE
    ) {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `Câu hỏi '${q.code}' thuộc loại lựa chọn phải có ít nhất 2 phương án trả lời`,
        });
      }
    }
  });

export const akinatorRuleOutcomePayloadSchema = z.object({
  categoryCode: z.string().trim().min(1).max(100),
  categoryLabel: z.string().trim().min(1).max(255),
  referenceTitle: z.string().trim().min(3).max(500),
  referenceSummary: z.string().trim().min(5).max(3000),
  suggestedDirections: z.array(z.string().trim().min(1).max(500)).default([]),
  cautionNotes: z.array(z.string().trim().min(1).max(500)).default([]),
  suggestedPriority: z.nativeEnum(PriorityLevel).nullable().optional(),
});

export const akinatorRuleInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Mã quy tắc phải có ít nhất 2 ký tự')
    .max(100, 'Mã quy tắc tối đa 100 ký tự')
    .regex(/^[A-Za-z0-9_]+$/, 'Mã quy tắc chỉ chứa chữ cái, số và dấu gạch dưới'),
  name: z.string().trim().min(3, 'Tên quy tắc phải có ít nhất 3 ký tự').max(255),
  description: z.string().trim().max(2000).nullable().optional(),
  priorityOrder: z.number().int().min(1).max(1000).default(1),
  requiredQuestionCodes: z.array(z.string().trim().min(1).max(100)).default([]),
  conditions: akinatorConditionGroupSchema,
  outcomePayload: akinatorRuleOutcomePayloadSchema,
  stopOnMatch: z.boolean().default(false),
  active: z.boolean().default(true),
});

export const createDraftConfigSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề cấu hình phải từ 3 đến 190 ký tự').max(190),
  description: z.string().trim().max(2000).nullable().optional(),
  maxQuestionsPerSession: z.number().int().min(1).max(100).default(15),
  disclaimerText: z
    .string()
    .trim()
    .min(10, 'Nội dung khuyến cáo tham khảo phải có ít nhất 10 ký tự')
    .max(3000)
    .optional(),
  changeLog: z.string().trim().max(2000).nullable().optional(),
  sourceVersionId: z.string().uuid('sourceVersionId không hợp lệ').optional(),
});

export const updateDraftMetadataSchema = z.object({
  title: z.string().trim().min(3).max(190).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  maxQuestionsPerSession: z.number().int().min(1).max(100).optional(),
  disclaimerText: z.string().trim().min(10).max(3000).optional(),
  changeLog: z.string().trim().max(2000).nullable().optional(),
});

export const saveDraftQuestionsSchema = z.object({
  questions: z.array(akinatorQuestionInputSchema).min(1, 'Cần có ít nhất 1 câu hỏi trong cấu hình'),
});

export const saveDraftRulesSchema = z.object({
  rules: z.array(akinatorRuleInputSchema).min(1, 'Cần có ít nhất 1 quy tắc đánh giá trong cấu hình'),
});

export const publishConfigSchema = z.object({
  changeLog: z.string().trim().max(2000).nullable().optional(),
});

export const configVersionIdParamSchema = z.object({
  versionId: z.string().uuid('versionId không hợp lệ'),
});

export const listConfigsQuerySchema = z.object({
  status: z.nativeEnum(AkinatorConfigStatus).optional(),
});

// =========================================================================
// PUBLIC QUIZ VALIDATIONS
// =========================================================================

export const sessionTokenParamSchema = z.object({
  token: z
    .string()
    .trim()
    .min(16, 'Token phiên làm bài không hợp lệ')
    .max(128, 'Token phiên làm bài không hợp lệ')
    .regex(/^[A-Za-z0-9_-]+$/, 'Định dạng token không hợp lệ'),
});

export const submitQuizAnswerSchema = z.object({
  questionCode: z
    .string()
    .trim()
    .min(1, 'Mã câu hỏi không được để trống')
    .max(100),
  answerValue: z.any().refine((val) => val !== undefined && val !== null && val !== '', {
    message: 'Câu trả lời không được để trống',
  }),
});

// =========================================================================
// ADMIN REVIEW & WORKFLOW VALIDATIONS
// =========================================================================

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('ID hồ sơ Akinator không hợp lệ'),
});

export const listAkinatorSessionsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? Math.max(1, parseInt(v, 10) || 1) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10) || 20)) : 20)),
  quizStatus: z.nativeEnum(AkinatorQuizStatus).optional(),
  workflowStatus: z.nativeEnum(AkinatorWorkflowStatus).optional(),
  evaluationStatus: z.nativeEnum(AkinatorEvaluationStatus).optional(),
  search: z.string().trim().max(200).optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

const strictOptionalDobSchema = z
  .union([z.string(), z.null()])
  .optional()
  .superRefine((val, ctx) => {
    if (val === undefined || val === null || val.trim() === '') return;
    const parsed = parseStrictDateOnly(val);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ngày sinh không hợp lệ (định dạng chuẩn dd/MM/yyyy hoặc yyyy-MM-dd)',
      });
    }
  });

/**
 * Strict Admin Review Update Schema:
 * Uses `.strict()` so any attempt to send `rawAnswers`, `answers`, or `result` in the payload
 * is immediately rejected by validation, protecting raw customer answers.
 */
export const updateAdminReviewSchema = z
  .object({
    editedFullName: z.string().trim().min(1, 'Họ tên không được để trống').max(190).nullable().optional(),
    editedPhone: z
      .string()
      .trim()
      .min(8, 'Số điện thoại phải từ 8 đến 20 ký tự')
      .max(20, 'Số điện thoại tối đa 20 ký tự')
      .regex(/^[0-9+\-\s()]+$/, 'Số điện thoại không hợp lệ')
      .nullable()
      .optional(),
    editedEmail: z.string().trim().email('Email không hợp lệ').max(190).nullable().optional().or(z.literal('')),
    editedGender: z.nativeEnum(Gender).nullable().optional(),
    editedDateOfBirth: strictOptionalDobSchema,
    editedAddress: z.string().trim().max(500).nullable().optional(),
    editedSource: z.string().trim().max(190).nullable().optional(),
    editedPriority: z.nativeEnum(PriorityLevel).nullable().optional(),
    processorNote: z.string().trim().max(5000).nullable().optional(),
    missingInfoNote: z.string().trim().max(3000).nullable().optional(),
    approvalNote: z.string().trim().max(3000).nullable().optional(),
  })
  .strict();

export const transitionWorkflowStatusSchema = z
  .object({
    toStatus: z.nativeEnum(AkinatorWorkflowStatus),
    note: z.string().trim().max(3000).nullable().optional(),
    missingInfoNote: z.string().trim().max(3000).nullable().optional(),
    approvalNote: z.string().trim().max(3000).nullable().optional(),
    rejectionReason: z.string().trim().max(3000).nullable().optional(),
  })
  .strict();

export const transferAkinatorSessionSchema = z
  .object({
    mode: z.enum(['LINK_EXISTING', 'CREATE_NEW'], {
      required_error: 'Phương thức chuyển (mode) không được để trống',
    }),
    existingCustomerId: z.string().uuid('ID khách hàng hiện tại không hợp lệ').optional(),
    confirmCreateNew: z.boolean().optional(),
  })
  .strict();
