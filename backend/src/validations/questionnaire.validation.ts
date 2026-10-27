import { z } from 'zod';
import { QuestionType, QuestionnaireVersionStatus } from '@prisma/client';

export const ConditionalOperatorEnum = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'LESS_THAN',
  'IS_EMPTY',
  'IS_NOT_EMPTY',
]);
export type ConditionalOperator = z.infer<typeof ConditionalOperatorEnum>;

// Option Schema for SINGLE_CHOICE and MULTIPLE_CHOICE
export const questionOptionSchema = z.object({
  id: z.string().min(1, 'Mã lựa chọn không được trống'),
  label: z.string().min(1, 'Nhãn lựa chọn không được trống').max(255),
  value: z.string().min(1, 'Giá trị lựa chọn không được trống').max(255),
  hasTextInput: z.boolean().optional().default(false),
  textInputPlaceholder: z.string().max(255).optional().nullable(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

// Validation Configuration Schema depending on question type
export const questionValidationConfigSchema = z.object({
  min: z.number().optional().nullable(),
  max: z.number().optional().nullable(),
  step: z.number().positive().optional().nullable(),
  minLength: z.number().int().nonnegative().optional().nullable(),
  maxLength: z.number().int().positive().optional().nullable(),
  minDate: z.string().optional().nullable(),
  maxDate: z.string().optional().nullable(),
  minSelect: z.number().int().nonnegative().optional().nullable(),
  maxSelect: z.number().int().positive().optional().nullable(),
  pattern: z.string().optional().nullable(),
  patternMessage: z.string().optional().nullable(),
}).refine((data) => {
  if (data.min != null && data.max != null && data.max < data.min) {
    return false;
  }
  if (data.minLength != null && data.maxLength != null && data.maxLength < data.minLength) {
    return false;
  }
  if (data.minSelect != null && data.maxSelect != null && data.maxSelect < data.minSelect) {
    return false;
  }
  if (data.minDate && data.maxDate) {
    const from = new Date(data.minDate);
    const to = new Date(data.maxDate);
    if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to < from) {
      return false;
    }
  }
  return true;
}, {
  message: 'Giới hạn Max phải lớn hơn hoặc bằng Min trong cấu hình validation',
});
export type QuestionValidationConfig = z.infer<typeof questionValidationConfigSchema>;

// Conditional Logic Schema
export const questionConditionalLogicSchema = z.object({
  dependsOnQuestionCode: z.string().min(1, 'Mã câu hỏi điều kiện không được để trống'),
  operator: ConditionalOperatorEnum,
  value: z.any().optional(),
}).refine((data) => {
  // Operators that require a value
  if (['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN'].includes(data.operator)) {
    return data.value !== undefined && data.value !== null && data.value !== '';
  }
  if (['IN', 'NOT_IN'].includes(data.operator)) {
    return Array.isArray(data.value) && data.value.length > 0;
  }
  return true;
}, {
  message: 'Toán tử điều kiện yêu cầu giá trị so sánh hợp lệ',
});
export type QuestionConditionalLogic = z.infer<typeof questionConditionalLogicSchema>;

// Question Definition Input Schema
export const questionDefinitionInputSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .min(2, 'Mã câu hỏi tối thiểu 2 ký tự')
    .max(50, 'Mã câu hỏi tối đa 50 ký tự')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Mã câu hỏi chỉ chứa chữ cái, số, gạch dưới và gạch ngang'),
  questionText: z.string().min(3, 'Nội dung câu hỏi tối thiểu 3 ký tự').max(1000),
  description: z.string().max(2000).optional().nullable(),
  questionType: z.nativeEnum(QuestionType),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  options: z.array(questionOptionSchema).optional().nullable(),
  validationConfig: questionValidationConfigSchema.optional().nullable(),
  conditionalLogic: questionConditionalLogicSchema.optional().nullable(),
  active: z.boolean().default(true),
}).superRefine((data, ctx) => {
  // Validate options for choice types
  if (data.questionType === QuestionType.SINGLE_CHOICE || data.questionType === QuestionType.MULTIPLE_CHOICE) {
    if (!data.options || data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: 'Câu hỏi dạng lựa chọn phải có ít nhất 2 phương án trả lời',
      });
    } else {
      const values = data.options.map((opt) => opt.value);
      const uniqueValues = new Set(values);
      if (uniqueValues.size !== values.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Giá trị các phương án trả lời không được trùng nhau',
        });
      }
    }
  }

  // Prevent self-reference in conditional logic
  if (data.conditionalLogic && data.conditionalLogic.dependsOnQuestionCode === data.code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['conditionalLogic', 'dependsOnQuestionCode'],
      message: 'Câu hỏi không thể tự tham chiếu điều kiện hiển thị tới chính nó',
    });
  }
});

export type QuestionDefinitionInput = z.infer<typeof questionDefinitionInputSchema>;

// Validate dependency graph for circular dependencies
export function validateQuestionnaireDependencyGraph(questions: Array<{ code: string; conditionalLogic?: QuestionConditionalLogic | null }>): {
  isValid: boolean;
  cycle?: string[];
  error?: string;
} {
  const codeSet = new Set(questions.map((q) => q.code));
  const adj = new Map<string, string[]>();

  for (const q of questions) {
    adj.set(q.code, []);
  }

  for (const q of questions) {
    if (q.conditionalLogic?.dependsOnQuestionCode) {
      const target = q.conditionalLogic.dependsOnQuestionCode;
      if (!codeSet.has(target)) {
        return {
          isValid: false,
          error: `Câu hỏi '${q.code}' tham chiếu đến câu hỏi không tồn tại '${target}'`,
        };
      }
      if (target === q.code) {
        return {
          isValid: false,
          error: `Câu hỏi '${q.code}' không thể phụ thuộc vào chính nó`,
        };
      }
      // Edge from target -> q.code (target must evaluate before q)
      adj.get(target)?.push(q.code);
    }
  }

  // Detect cycle using DFS (0: unvisited, 1: visiting, 2: visited)
  const state = new Map<string, number>();
  for (const code of codeSet) {
    state.set(code, 0);
  }

  const stack: string[] = [];

  function dfs(node: string): boolean {
    state.set(node, 1);
    stack.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const s = state.get(neighbor);
      if (s === 1) {
        // Cycle detected
        const cycleStartIndex = stack.indexOf(neighbor);
        const cycle = stack.slice(cycleStartIndex).concat(neighbor);
        return false;
      }
      if (s === 0) {
        if (!dfs(neighbor)) return false;
      }
    }

    stack.pop();
    state.set(node, 2);
    return true;
  }

  for (const code of codeSet) {
    if (state.get(code) === 0) {
      if (!dfs(code)) {
        return {
          isValid: false,
          cycle: stack,
          error: `Phát hiện chu trình điều kiện phụ thuộc vòng quanh: ${stack.join(' -> ')}`,
        };
      }
    }
  }

  return { isValid: true };
}

// Questionnaire Level Schemas
export const createQuestionnaireSchema = z.object({
  code: z
    .string()
    .min(3, 'Mã bộ câu hỏi tối thiểu 3 ký tự')
    .max(50, 'Mã bộ câu hỏi tối đa 50 ký tự')
    .regex(/^[A-Z0-9_-]+$/, 'Mã bộ câu hỏi viết HOA, chỉ chứa chữ cái, số, gạch ngang và gạch dưới'),
  title: z.string().min(3, 'Tiêu đề bộ câu hỏi tối thiểu 3 ký tự').max(255),
  description: z.string().max(2000).optional().nullable(),
  active: z.boolean().default(true),
  initialQuestions: z.array(questionDefinitionInputSchema).optional(),
});

export const updateQuestionnaireSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

export const createDraftVersionSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  changeLog: z.string().max(2000).optional().nullable(),
  sourceVersionId: z.string().uuid().optional(),
});

export const saveDraftQuestionsSchema = z.object({
  questions: z.array(questionDefinitionInputSchema),
}).superRefine((data, ctx) => {
  // Check duplicate codes in version
  const codes = data.questions.map((q) => q.code);
  const seen = new Set<string>();
  for (const code of codes) {
    if (seen.has(code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions'],
        message: `Mã câu hỏi '${code}' bị trùng lặp trong phiên bản`,
      });
      break;
    }
    seen.add(code);
  }

  // Check conditional dependency graph
  const graphValidation = validateQuestionnaireDependencyGraph(data.questions);
  if (!graphValidation.isValid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['questions'],
      message: graphValidation.error || 'Lỗi logic điều kiện hiển thị không hợp lệ',
    });
  }
});

export const reorderQuestionsSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      displayOrder: z.number().int().nonnegative(),
    })
  ).min(1, 'Danh sách sắp xếp không được trống'),
});

export const publishVersionSchema = z.object({
  changeLog: z.string().max(2000).optional().nullable(),
});

export const questionnaireIdParamSchema = z.object({
  id: z.string().uuid('ID bộ câu hỏi không hợp lệ'),
});

export const versionIdParamSchema = z.object({
  id: z.string().uuid('ID bộ câu hỏi không hợp lệ'),
  versionId: z.string().uuid('ID phiên bản không hợp lệ'),
});

export const questionIdParamSchema = z.object({
  id: z.string().uuid('ID bộ câu hỏi không hợp lệ'),
  versionId: z.string().uuid('ID phiên bản không hợp lệ'),
  questionId: z.string().uuid('ID câu hỏi không hợp lệ'),
});
