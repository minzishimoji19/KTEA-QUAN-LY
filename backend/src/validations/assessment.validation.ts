import { z } from 'zod';
import { AssessmentStatus, QuestionType } from '@prisma/client';
import {
  QuestionOption,
  QuestionValidationConfig,
  QuestionConditionalLogic,
} from './questionnaire.validation.js';

// Input schemas for HTTP endpoints
export const createAssessmentSchema = z
  .object({
    questionnaireId: z.string().uuid('ID bộ câu hỏi không hợp lệ').optional(),
    questionnaireVersionId: z.string().uuid('ID phiên bản không hợp lệ').optional(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (data) => Boolean(data.questionnaireId || data.questionnaireVersionId),
    'Phải cung cấp questionnaireId hoặc questionnaireVersionId để bắt đầu đánh giá'
  );

export const singleAnswerInputSchema = z.object({
  questionCode: z.string().min(1, 'Mã câu hỏi không được để trống'),
  questionId: z.string().uuid().optional().nullable(),
  answerValue: z.any(),
});

export const saveAssessmentAnswersSchema = z.object({
  answers: z.array(singleAnswerInputSchema),
  notes: z.string().max(2000).optional().nullable(),
});

export const completeAssessmentSchema = z.object({
  answers: z.array(singleAnswerInputSchema).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const assessmentIdParamSchema = z.object({
  assessmentId: z.string().uuid('ID bài đánh giá không hợp lệ'),
});

export const customerAssessmentParamsSchema = z.object({
  id: z.string().uuid('ID khách hàng không hợp lệ'),
  assessmentId: z.string().uuid('ID bài đánh giá không hợp lệ').optional(),
});

// Types for validation engine
export interface QuestionEvalContext {
  id: string;
  code: string;
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  displayOrder: number;
  options?: QuestionOption[] | null;
  validationConfig?: QuestionValidationConfig | null;
  conditionalLogic?: QuestionConditionalLogic | null;
  active: boolean;
}

export interface ValidationEngineResult {
  isValid: boolean;
  errors: string[];
  cleanAnswers: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>;
  visibleQuestionCodes: Set<string>;
}

/**
 * Pure validation engine for assessment answers against QuestionDefinition rules.
 * Computes visibility dynamically and validates typed answers.
 */
export function validateAssessmentAnswers(
  questions: QuestionEvalContext[],
  submittedAnswers: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>,
  mode: 'DRAFT' | 'COMPLETE'
): ValidationEngineResult {
  const errors: string[] = [];
  const answerMap = new Map<string, any>();
  const idMap = new Map<string, string | null>();

  for (const item of submittedAnswers) {
    answerMap.set(item.questionCode, item.answerValue);
    if (item.questionId) {
      idMap.set(item.questionCode, item.questionId);
    }
  }

  // 1. Sort questions by displayOrder
  const sortedQuestions = [...questions].sort((a, b) => a.displayOrder - b.displayOrder);

  // 2. Compute dynamic visibility for all questions
  const visibilityMap = new Map<string, boolean>();

  for (const q of sortedQuestions) {
    if (!q.active) {
      visibilityMap.set(q.code, false);
      continue;
    }

    if (!q.conditionalLogic || !q.conditionalLogic.dependsOnQuestionCode) {
      visibilityMap.set(q.code, true);
      continue;
    }

    const { dependsOnQuestionCode, operator, value } = q.conditionalLogic;
    const isSourceVisible = visibilityMap.get(dependsOnQuestionCode) ?? false;

    if (!isSourceVisible) {
      visibilityMap.set(q.code, false);
      continue;
    }

    const rawSourceAnswer = answerMap.get(dependsOnQuestionCode);
    let sourceAnswerScalar: any = rawSourceAnswer;

    // Normalize object-based answers (e.g. { value: "..." } or { values: [...] })
    if (rawSourceAnswer && typeof rawSourceAnswer === 'object' && !Array.isArray(rawSourceAnswer)) {
      sourceAnswerScalar = rawSourceAnswer.value ?? rawSourceAnswer.values ?? rawSourceAnswer;
    }

    let isMatch = false;
    switch (operator) {
      case 'EQUALS':
        isMatch = String(sourceAnswerScalar ?? '') === String(value ?? '');
        break;
      case 'NOT_EQUALS':
        isMatch = String(sourceAnswerScalar ?? '') !== String(value ?? '');
        break;
      case 'IN':
        if (Array.isArray(value)) {
          isMatch = value.some((v) => String(v) === String(sourceAnswerScalar ?? ''));
        }
        break;
      case 'NOT_IN':
        if (Array.isArray(value)) {
          isMatch = !value.some((v) => String(v) === String(sourceAnswerScalar ?? ''));
        }
        break;
      case 'GREATER_THAN':
        isMatch = Number(sourceAnswerScalar ?? 0) > Number(value ?? 0);
        break;
      case 'LESS_THAN':
        isMatch = Number(sourceAnswerScalar ?? 0) < Number(value ?? 0);
        break;
      case 'IS_EMPTY':
        isMatch =
          sourceAnswerScalar === undefined ||
          sourceAnswerScalar === null ||
          sourceAnswerScalar === '' ||
          (Array.isArray(sourceAnswerScalar) && sourceAnswerScalar.length === 0);
        break;
      case 'IS_NOT_EMPTY':
        isMatch =
          sourceAnswerScalar !== undefined &&
          sourceAnswerScalar !== null &&
          sourceAnswerScalar !== '' &&
          (!Array.isArray(sourceAnswerScalar) || sourceAnswerScalar.length > 0);
        break;
      default:
        isMatch = true;
    }

    visibilityMap.set(q.code, isMatch);
  }

  // 3. Validate answers for each question
  const cleanAnswers: Array<{ questionCode: string; questionId?: string | null; answerValue: any }> = [];
  const visibleQuestionCodes = new Set<string>();

  for (const q of sortedQuestions) {
    const isVisible = visibilityMap.get(q.code) ?? false;
    if (isVisible) {
      visibleQuestionCodes.add(q.code);
    }

    const rawVal = answerMap.get(q.code);

    // If question is hidden, we skip adding it to cleanAnswers (clearing stale answer)
    if (!isVisible) {
      continue;
    }

    // Check if empty
    const isEmpty =
      rawVal === undefined ||
      rawVal === null ||
      rawVal === '' ||
      (Array.isArray(rawVal) && rawVal.length === 0) ||
      (typeof rawVal === 'object' && !Array.isArray(rawVal) && !rawVal.value && (!rawVal.values || rawVal.values.length === 0));

    // In complete mode, check mandatory fields
    if (mode === 'COMPLETE' && q.isRequired && isEmpty) {
      errors.push(`Câu hỏi bắt buộc chưa được trả lời: "${q.questionText}" [${q.code}]`);
      continue;
    }

    // If not empty, validate value strictly against question definition
    if (!isEmpty) {
      const valError = validateSingleAnswerValue(q, rawVal);
      if (valError) {
        errors.push(`Lỗi câu hỏi "${q.questionText}" [${q.code}]: ${valError}`);
      } else {
        cleanAnswers.push({
          questionCode: q.code,
          questionId: idMap.get(q.code) || q.id,
          answerValue: rawVal,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanAnswers,
    visibleQuestionCodes,
  };
}

function validateSingleAnswerValue(q: QuestionEvalContext, val: any): string | null {
  const cfg = q.validationConfig;

  switch (q.questionType) {
    case QuestionType.SINGLE_CHOICE: {
      const selectedValue = typeof val === 'object' && val !== null ? val.value : val;
      if (!selectedValue || typeof selectedValue !== 'string') {
        return 'Giá trị lựa chọn không hợp lệ';
      }
      const validOptions = (q.options || []).map((opt) => opt.value);
      if (!validOptions.includes(selectedValue)) {
        return `Giá trị '${selectedValue}' không thuộc danh sách lựa chọn của câu hỏi`;
      }
      return null;
    }

    case QuestionType.MULTIPLE_CHOICE: {
      const selectedValues = Array.isArray(val)
        ? val
        : typeof val === 'object' && val !== null && Array.isArray(val.values)
        ? val.values
        : null;

      if (!selectedValues || !Array.isArray(selectedValues)) {
        return 'Dữ liệu chọn nhiều phương án phải là mảng';
      }

      const validOptions = (q.options || []).map((opt) => opt.value);
      for (const item of selectedValues) {
        if (!validOptions.includes(item)) {
          return `Lựa chọn '${item}' không thuộc danh sách lựa chọn của câu hỏi`;
        }
      }

      if (cfg?.minSelect != null && selectedValues.length < cfg.minSelect) {
        return `Cần chọn tối thiểu ${cfg.minSelect} phương án`;
      }
      if (cfg?.maxSelect != null && selectedValues.length > cfg.maxSelect) {
        return `Chỉ được chọn tối đa ${cfg.maxSelect} phương án`;
      }
      return null;
    }

    case QuestionType.YES_NO: {
      const boolVal = typeof val === 'boolean' ? val : val === 'YES' ? true : val === 'NO' ? false : null;
      if (boolVal === null) {
        return 'Câu hỏi Có/Không chỉ chấp nhận giá trị Có (true) hoặc Không (false)';
      }
      return null;
    }

    case QuestionType.NUMBER:
    case QuestionType.CURRENCY: {
      const num = Number(val);
      if (isNaN(num) || !isFinite(num)) {
        return 'Giá trị nhập vào phải là số hợp lệ';
      }
      if (q.questionType === QuestionType.CURRENCY && num < 0) {
        return 'Số tiền tài chính không được là số âm';
      }
      if (cfg?.min != null && num < cfg.min) {
        return `Giá trị không được nhỏ hơn ${cfg.min.toLocaleString('vi-VN')}`;
      }
      if (cfg?.max != null && num > cfg.max) {
        return `Giá trị không được vượt quá ${cfg.max.toLocaleString('vi-VN')}`;
      }
      return null;
    }

    case QuestionType.TEXT:
    case QuestionType.LONG_TEXT: {
      if (typeof val !== 'string') {
        return 'Dữ liệu văn bản không hợp lệ';
      }
      const str = val.trim();
      if (cfg?.minLength != null && str.length < cfg.minLength) {
        return `Độ dài văn bản tối thiểu là ${cfg.minLength} ký tự`;
      }
      if (cfg?.maxLength != null && str.length > cfg.maxLength) {
        return `Độ dài văn bản tối đa là ${cfg.maxLength} ký tự`;
      }
      return null;
    }

    case QuestionType.DATE: {
      if (typeof val !== 'string') {
        return 'Định dạng ngày không hợp lệ';
      }
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        return 'Ngày tháng không hợp lệ (định dạng chuẩn YYYY-MM-DD)';
      }
      if (cfg?.minDate) {
        const minD = new Date(cfg.minDate);
        if (d < minD) return `Ngày không được trước ${cfg.minDate}`;
      }
      if (cfg?.maxDate) {
        const maxD = new Date(cfg.maxDate);
        if (d > maxD) return `Ngày không được sau ${cfg.maxDate}`;
      }
      return null;
    }

    default:
      return null;
  }
}
