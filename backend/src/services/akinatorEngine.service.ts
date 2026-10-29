/**
 * akinatorEngine.service.ts
 * Isolated Adaptive Question Engine & Deterministic Rule Engine for the Akinator Module.
 *
 * Principles (Phase 2):
 * 1. Zero coupling with Needs Assessment (`Questionnaire` / `Assessment`).
 * 2. Strict separation between Question Visibility Conditions (`isQuestionEligibleToDisplay`)
 *    and Next Question Selection Algorithm (`selectNextQuestion`).
 * 3. Deterministic, explainable Rule Engine with explicit `INSUFFICIENT_DATA` detection
 *    and mandatory preliminary reference disclaimer (never claiming loan approval).
 */

import {
  AkinatorQuestionType,
  AkinatorEvaluationStatus,
  PriorityLevel,
} from '@prisma/client';
import { parseStrictDateOnly } from '../utils/dateUtils.js';
import { BadRequestError } from '../utils/errors.js';

export type AkinatorConditionOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'IN'
  | 'NOT_IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'CONTAINS'
  | 'IS_ANSWERED'
  | 'IS_NOT_ANSWERED';

export interface AkinatorSingleCondition {
  questionCode: string;
  operator: AkinatorConditionOperator;
  value?: any;
}

export interface AkinatorConditionGroup {
  logic: 'AND' | 'OR';
  conditions: AkinatorSingleCondition[];
}

export interface AkinatorNextQuestionRule {
  logic: 'AND' | 'OR';
  conditions: AkinatorSingleCondition[];
  action: 'GOTO_QUESTION' | 'END_QUIZ';
  targetQuestionCode?: string | null;
  reason?: string | null;
}

export interface AkinatorQuestionOption {
  value: string;
  label: string;
  description?: string | null;
}

export interface AkinatorQuestionDef {
  id: string;
  code: string;
  questionText: string;
  description?: string | null;
  questionType: AkinatorQuestionType;
  isEntryQuestion: boolean;
  isRequiredForEval: boolean;
  priorityWeight: number;
  mapsToCustomerField?: string;
  options?: AkinatorQuestionOption[] | any;
  validationConfig?: Record<string, any> | null;
  visibilityConditions?: AkinatorConditionGroup | any;
  nextQuestionRules?: AkinatorNextQuestionRule[] | any;
  active: boolean;
}

export interface AkinatorRuleOutcomePayload {
  categoryCode: string;
  categoryLabel: string;
  referenceTitle: string;
  referenceSummary: string;
  suggestedDirections?: string[];
  cautionNotes?: string[];
  suggestedPriority?: PriorityLevel | null;
}

export interface AkinatorRuleDef {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  priorityOrder: number;
  requiredQuestionCodes: string[] | any;
  conditions: AkinatorConditionGroup | any;
  outcomePayload: AkinatorRuleOutcomePayload | any;
  stopOnMatch: boolean;
  active: boolean;
}

export interface AkinatorAnsweredRecord {
  questionId: string;
  questionCode: string;
  answerValue: any;
  stepOrder: number;
}

export interface NextQuestionSelectionResult {
  nextQuestion: AkinatorQuestionDef | null;
  readyToComplete: boolean;
  selectionReason: string;
  progress: {
    answeredCount: number;
    remainingEligibleCount: number;
    maxQuestionsPerSession: number;
  };
}

export interface AkinatorRuleEvaluationOutput {
  evaluationStatus: AkinatorEvaluationStatus;
  summaryTitle: string;
  summaryDescription: string;
  outcomeData: {
    categories: Array<{
      ruleCode: string;
      ruleName: string;
      categoryCode: string;
      categoryLabel: string;
      referenceTitle: string;
      referenceSummary: string;
      suggestedDirections: string[];
      cautionNotes: string[];
      suggestedPriority: PriorityLevel | null;
    }>;
    primaryPriority: PriorityLevel | null;
    isReferenceOnly: true;
  };
  missingCriteria: Array<{
    questionCode: string;
    questionText: string;
    reason: string;
  }>;
  matchedRulesSnapshot: Array<{
    ruleId: string;
    ruleCode: string;
    ruleName: string;
    priorityOrder: number;
    outcomePayload: AkinatorRuleOutcomePayload;
  }>;
  answersSnapshot: Record<string, any>;
  disclaimerText: string;
}

export const DEFAULT_AKINATOR_DISCLAIMER =
  'Lưu ý quan trọng: Kết quả trên chỉ mang tính chất tham khảo sơ bộ dựa trên thông tin bạn đã cung cấp trong phiên làm quiz. Kết quả này KHÔNG phải là cam kết phê duyệt tín dụng, KHÔNG ấn định hạn mức vay hay lãi suất chính thức. Chuyên viên KTEA sẽ kiểm tra và liên hệ tư vấn chi tiết sau khi hồ sơ được rà soát.';

/**
 * Evaluates a single condition against the current session's answer map.
 */
export function evaluateSingleCondition(
  condition: AkinatorSingleCondition,
  answersMap: Map<string, any>
): boolean {
  const hasAnswer = answersMap.has(condition.questionCode);
  const rawAnswer = answersMap.get(condition.questionCode);

  const isAnswered =
    hasAnswer &&
    rawAnswer !== undefined &&
    rawAnswer !== null &&
    rawAnswer !== '' &&
    !(Array.isArray(rawAnswer) && rawAnswer.length === 0);

  if (condition.operator === 'IS_ANSWERED') {
    return isAnswered;
  }
  if (condition.operator === 'IS_NOT_ANSWERED') {
    return !isAnswered;
  }

  // All value-comparison operators require the referenced question to have been answered
  if (!isAnswered) {
    return false;
  }

  const targetVal = condition.value;

  switch (condition.operator) {
    case 'EQUALS': {
      if (Array.isArray(rawAnswer)) {
        return rawAnswer.map(String).includes(String(targetVal));
      }
      if (typeof rawAnswer === 'boolean' || typeof targetVal === 'boolean') {
        return String(rawAnswer).toLowerCase() === String(targetVal).toLowerCase();
      }
      return String(rawAnswer).trim() === String(targetVal).trim();
    }
    case 'NOT_EQUALS': {
      if (Array.isArray(rawAnswer)) {
        return !rawAnswer.map(String).includes(String(targetVal));
      }
      return String(rawAnswer).trim() !== String(targetVal).trim();
    }
    case 'IN': {
      const list = Array.isArray(targetVal) ? targetVal.map(String) : [String(targetVal)];
      if (Array.isArray(rawAnswer)) {
        return rawAnswer.some((item) => list.includes(String(item)));
      }
      return list.includes(String(rawAnswer));
    }
    case 'NOT_IN': {
      const list = Array.isArray(targetVal) ? targetVal.map(String) : [String(targetVal)];
      if (Array.isArray(rawAnswer)) {
        return !rawAnswer.some((item) => list.includes(String(item)));
      }
      return !list.includes(String(rawAnswer));
    }
    case 'GT': {
      const numA = Number(rawAnswer);
      const numB = Number(targetVal);
      return !isNaN(numA) && !isNaN(numB) && numA > numB;
    }
    case 'GTE': {
      const numA = Number(rawAnswer);
      const numB = Number(targetVal);
      return !isNaN(numA) && !isNaN(numB) && numA >= numB;
    }
    case 'LT': {
      const numA = Number(rawAnswer);
      const numB = Number(targetVal);
      return !isNaN(numA) && !isNaN(numB) && numA < numB;
    }
    case 'LTE': {
      const numA = Number(rawAnswer);
      const numB = Number(targetVal);
      return !isNaN(numA) && !isNaN(numB) && numA <= numB;
    }
    case 'CONTAINS': {
      if (Array.isArray(rawAnswer)) {
        return rawAnswer.map(String).includes(String(targetVal));
      }
      return String(rawAnswer).toLowerCase().includes(String(targetVal ?? '').toLowerCase());
    }
    default:
      return false;
  }
}

/**
 * Evaluates a group of conditions (AND / OR).
 * If group is null/undefined or has no conditions, returns true.
 */
export function evaluateConditionGroup(
  group: AkinatorConditionGroup | null | undefined,
  answersMap: Map<string, any>
): boolean {
  if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
    return true;
  }

  if (group.logic === 'OR') {
    return group.conditions.some((c) => evaluateSingleCondition(c, answersMap));
  }

  return group.conditions.every((c) => evaluateSingleCondition(c, answersMap));
}

/**
 * Part 1 of Question Engine:
 * Determines strictly whether a question is eligible to be displayed given the current session's answers.
 */
export function isQuestionEligibleToDisplay(
  question: AkinatorQuestionDef,
  answersMap: Map<string, any>
): boolean {
  if (!question.active) {
    return false;
  }
  const visGroup = question.visibilityConditions as AkinatorConditionGroup | null | undefined;
  return evaluateConditionGroup(visGroup, answersMap);
}

/**
 * Part 2 of Question Engine:
 * Selects the next question deterministically based on:
 * 1. Session question limit (`maxQuestionsPerSession`).
 * 2. Explicit branching rules (`nextQuestionRules`) on the most recently answered question.
 * 3. Remaining unanswered & eligible questions sorted by:
 *    - `isEntryQuestion` (unanswered entry questions first)
 *    - `isRequiredForEval` (required evaluation questions next)
 *    - `priorityWeight DESC`
 *    - `code ASC` (deterministic tie-breaker)
 */
export function selectNextQuestion(params: {
  questions: AkinatorQuestionDef[];
  answeredRecords: AkinatorAnsweredRecord[];
  maxQuestionsPerSession: number;
}): NextQuestionSelectionResult {
  const { questions, answeredRecords, maxQuestionsPerSession } = params;

  const sortedAnswers = [...answeredRecords].sort((a, b) => a.stepOrder - b.stepOrder);
  const answeredCodes = new Set<string>(sortedAnswers.map((a) => a.questionCode));
  const answersMap = new Map<string, any>();
  for (const ans of sortedAnswers) {
    answersMap.set(ans.questionCode, ans.answerValue);
  }

  const questionByCode = new Map<string, AkinatorQuestionDef>();
  for (const q of questions) {
    if (q.active) {
      questionByCode.set(q.code, q);
    }
  }

  // Helper to compute remaining eligible unanswered count
  const getEligibleUnanswered = (): AkinatorQuestionDef[] => {
    return questions.filter(
      (q) =>
        q.active &&
        !answeredCodes.has(q.code) &&
        isQuestionEligibleToDisplay(q, answersMap)
    );
  };

  // 1. Check if session reached max questions limit
  if (sortedAnswers.length >= maxQuestionsPerSession) {
    return {
      nextQuestion: null,
      readyToComplete: true,
      selectionReason: `Đã đạt số câu hỏi tối đa của phiên (${maxQuestionsPerSession} câu)`,
      progress: {
        answeredCount: sortedAnswers.length,
        remainingEligibleCount: 0,
        maxQuestionsPerSession,
      },
    };
  }

  // 2. Check explicit branching rules (`nextQuestionRules`) on the latest answered question
  if (sortedAnswers.length > 0) {
    const latestAnswer = sortedAnswers[sortedAnswers.length - 1];
    const latestQuestion = questionByCode.get(latestAnswer.questionCode);
    const branchRules: AkinatorNextQuestionRule[] = Array.isArray(latestQuestion?.nextQuestionRules)
      ? latestQuestion!.nextQuestionRules
      : [];

    for (const rule of branchRules) {
      const matched = evaluateConditionGroup(
        { logic: rule.logic || 'AND', conditions: rule.conditions || [] },
        answersMap
      );
      if (!matched) continue;

      if (rule.action === 'END_QUIZ') {
        return {
          nextQuestion: null,
          readyToComplete: true,
          selectionReason:
            rule.reason ||
            `Kết thúc sớm theo quy tắc rẽ nhánh từ câu hỏi '${latestQuestion?.code}'`,
          progress: {
            answeredCount: sortedAnswers.length,
            remainingEligibleCount: 0,
            maxQuestionsPerSession,
          },
        };
      }

      if (rule.action === 'GOTO_QUESTION' && rule.targetQuestionCode) {
        const targetQ = questionByCode.get(rule.targetQuestionCode);
        if (
          targetQ &&
          !answeredCodes.has(targetQ.code) &&
          isQuestionEligibleToDisplay(targetQ, answersMap)
        ) {
          const remaining = getEligibleUnanswered();
          return {
            nextQuestion: targetQ,
            readyToComplete: false,
            selectionReason:
              rule.reason ||
              `Rẽ nhánh trực tiếp từ câu hỏi '${latestQuestion?.code}' sang '${targetQ.code}'`,
            progress: {
              answeredCount: sortedAnswers.length,
              remainingEligibleCount: remaining.length,
              maxQuestionsPerSession,
            },
          };
        }
      }
    }
  }

  // 3. Fallback to Priority-based Adaptive Selection among all eligible unanswered questions
  const eligibleCandidates = getEligibleUnanswered();

  if (eligibleCandidates.length === 0) {
    return {
      nextQuestion: null,
      readyToComplete: true,
      selectionReason: 'Đã hoàn thành tất cả các câu hỏi phù hợp với nhánh hiện tại',
      progress: {
        answeredCount: sortedAnswers.length,
        remainingEligibleCount: 0,
        maxQuestionsPerSession,
      },
    };
  }

  eligibleCandidates.sort((a, b) => {
    // 3a. Entry questions first (if unanswered)
    if (a.isEntryQuestion !== b.isEntryQuestion) {
      return a.isEntryQuestion ? -1 : 1;
    }
    // 3b. Questions required for evaluation next
    if (a.isRequiredForEval !== b.isRequiredForEval) {
      return a.isRequiredForEval ? -1 : 1;
    }
    // 3c. Higher priorityWeight first
    if (b.priorityWeight !== a.priorityWeight) {
      return b.priorityWeight - a.priorityWeight;
    }
    // 3d. Deterministic alphabetical tie-breaker by code
    return a.code.localeCompare(b.code);
  });

  const chosen = eligibleCandidates[0];
  let reason = `Chọn theo độ ưu tiên (priorityWeight=${chosen.priorityWeight})`;
  if (chosen.isEntryQuestion) {
    reason = `Câu hỏi mở đầu phiên quiz (${chosen.code})`;
  } else if (chosen.isRequiredForEval) {
    reason = `Câu hỏi bắt buộc để đủ dữ liệu đánh giá (priorityWeight=${chosen.priorityWeight})`;
  }

  return {
    nextQuestion: chosen,
    readyToComplete: false,
    selectionReason: reason,
    progress: {
      answeredCount: sortedAnswers.length,
      remainingEligibleCount: eligibleCandidates.length,
      maxQuestionsPerSession,
    },
  };
}

/**
 * Validates and normalizes a user's answer against an AkinatorQuestion definition.
 * Throws BadRequestError if the answer is invalid or missing.
 */
export function validateAndNormalizeQuizAnswer(
  question: AkinatorQuestionDef,
  rawInput: any
): { normalizedValue: any; labelSnapshot: string | null } {
  if (rawInput === undefined || rawInput === null || rawInput === '') {
    throw new BadRequestError(`Câu trả lời cho câu hỏi '${question.code}' không được để trống`);
  }

  const options: AkinatorQuestionOption[] = Array.isArray(question.options) ? question.options : [];
  const valConfig = question.validationConfig || {};

  switch (question.questionType) {
    case AkinatorQuestionType.SINGLE_CHOICE: {
      const strVal = String(rawInput).trim();
      const matchedOpt = options.find((o) => String(o.value) === strVal);
      if (!matchedOpt) {
        throw new BadRequestError(
          `Giá trị lựa chọn '${strVal}' không hợp lệ cho câu hỏi '${question.code}'`
        );
      }
      return {
        normalizedValue: matchedOpt.value,
        labelSnapshot: matchedOpt.label,
      };
    }

    case AkinatorQuestionType.MULTIPLE_CHOICE: {
      if (!Array.isArray(rawInput) || rawInput.length === 0) {
        throw new BadRequestError(
          `Câu hỏi '${question.code}' yêu cầu chọn ít nhất 1 phương án trả lời`
        );
      }
      const normalizedArr: string[] = [];
      const labels: string[] = [];
      for (const item of rawInput) {
        const strVal = String(item).trim();
        const matchedOpt = options.find((o) => String(o.value) === strVal);
        if (!matchedOpt) {
          throw new BadRequestError(
            `Giá trị lựa chọn '${strVal}' không hợp lệ cho câu hỏi '${question.code}'`
          );
        }
        if (!normalizedArr.includes(matchedOpt.value)) {
          normalizedArr.push(matchedOpt.value);
          labels.push(matchedOpt.label);
        }
      }
      return {
        normalizedValue: normalizedArr,
        labelSnapshot: labels.join(', '),
      };
    }

    case AkinatorQuestionType.YES_NO: {
      let boolVal: boolean;
      if (typeof rawInput === 'boolean') {
        boolVal = rawInput;
      } else if (String(rawInput).toLowerCase() === 'true' || String(rawInput).toUpperCase() === 'YES') {
        boolVal = true;
      } else if (String(rawInput).toLowerCase() === 'false' || String(rawInput).toUpperCase() === 'NO') {
        boolVal = false;
      } else {
        throw new BadRequestError(`Câu hỏi '${question.code}' chỉ chấp nhận giá trị Có/Không (true/false)`);
      }
      return {
        normalizedValue: boolVal,
        labelSnapshot: boolVal ? 'Có' : 'Không',
      };
    }

    case AkinatorQuestionType.NUMBER:
    case AkinatorQuestionType.CURRENCY: {
      const numVal = typeof rawInput === 'number' ? rawInput : Number(String(rawInput).replace(/,/g, '').trim());
      if (isNaN(numVal) || !isFinite(numVal)) {
        throw new BadRequestError(`Câu hỏi '${question.code}' yêu cầu giá trị số hợp lệ`);
      }
      if (typeof valConfig.min === 'number' && numVal < valConfig.min) {
        throw new BadRequestError(
          `Giá trị câu hỏi '${question.code}' không được nhỏ hơn ${valConfig.min}`
        );
      }
      if (typeof valConfig.max === 'number' && numVal > valConfig.max) {
        throw new BadRequestError(
          `Giá trị câu hỏi '${question.code}' không được lớn hơn ${valConfig.max}`
        );
      }
      return {
        normalizedValue: numVal,
        labelSnapshot: String(numVal),
      };
    }

    case AkinatorQuestionType.DATE: {
      const parsedDate = parseStrictDateOnly(String(rawInput));
      if (!parsedDate) {
        throw new BadRequestError(
          `Ngày tháng cho câu hỏi '${question.code}' không hợp lệ (định dạng chuẩn dd/MM/yyyy hoặc yyyy-MM-dd)`
        );
      }
      if (valConfig.minDate) {
        const minParsed = parseStrictDateOnly(valConfig.minDate);
        if (minParsed && parsedDate.isoDate < minParsed.isoDate) {
          throw new BadRequestError(
            `Ngày của câu hỏi '${question.code}' không được trước ngày ${minParsed.displayDate}`
          );
        }
      }
      if (valConfig.maxDate) {
        const maxParsed = parseStrictDateOnly(valConfig.maxDate);
        if (maxParsed && parsedDate.isoDate > maxParsed.isoDate) {
          throw new BadRequestError(
            `Ngày của câu hỏi '${question.code}' không được sau ngày ${maxParsed.displayDate}`
          );
        }
      }
      return {
        normalizedValue: parsedDate.isoDate,
        labelSnapshot: parsedDate.displayDate,
      };
    }

    case AkinatorQuestionType.TEXT:
    default: {
      const strVal = String(rawInput).trim();
      if (!strVal) {
        throw new BadRequestError(`Câu trả lời cho câu hỏi '${question.code}' không được để trống`);
      }
      if (typeof valConfig.minLength === 'number' && strVal.length < valConfig.minLength) {
        throw new BadRequestError(
          `Câu trả lời cho câu hỏi '${question.code}' phải có ít nhất ${valConfig.minLength} ký tự`
        );
      }
      if (typeof valConfig.maxLength === 'number' && strVal.length > valConfig.maxLength) {
        throw new BadRequestError(
          `Câu trả lời cho câu hỏi '${question.code}' tối đa ${valConfig.maxLength} ký tự`
        );
      }
      if (valConfig.pattern) {
        const regex = new RegExp(valConfig.pattern);
        if (!regex.test(strVal)) {
          throw new BadRequestError(`Định dạng câu trả lời cho câu hỏi '${question.code}' không hợp lệ`);
        }
      }
      return {
        normalizedValue: strVal,
        labelSnapshot: strVal,
      };
    }
  }
}

/**
 * Deterministic Rule Engine for Akinator:
 * - Distinguishes clearly between `EVALUATED` (sufficient data) and `INSUFFICIENT_DATA` (missing required inputs).
 * - Never fabricates unapproved credit thresholds or financial formulas.
 * - Always attaches the versioned rules snapshot and preliminary reference disclaimer.
 */
export function evaluateAkinatorRules(params: {
  questions: AkinatorQuestionDef[];
  rules: AkinatorRuleDef[];
  answeredRecords: AkinatorAnsweredRecord[];
  disclaimerText?: string | null;
}): AkinatorRuleEvaluationOutput {
  const { questions, rules, answeredRecords } = params;
  const disclaimer =
    disclaimerTextOrDefault(params.disclaimerText);

  const answersMap = new Map<string, any>();
  const answersSnapshot: Record<string, any> = {};

  for (const ans of answeredRecords) {
    answersMap.set(ans.questionCode, ans.answerValue);
    answersSnapshot[ans.questionCode] = ans.answerValue;
  }

  const questionByCode = new Map<string, AkinatorQuestionDef>();
  for (const q of questions) {
    questionByCode.set(q.code, q);
  }

  // 1. Check globally required questions (questions marked `isRequiredForEval = true` that were eligible in this branch)
  const missingCriteria: Array<{ questionCode: string; questionText: string; reason: string }> = [];

  for (const q of questions) {
    if (!q.active || !q.isRequiredForEval) continue;
    // Only require if the question is eligible to display in the current branch
    if (isQuestionEligibleToDisplay(q, answersMap)) {
      const val = answersMap.get(q.code);
      const isPresent =
        val !== undefined &&
        val !== null &&
        val !== '' &&
        !(Array.isArray(val) && val.length === 0);
      if (!isPresent) {
        missingCriteria.push({
          questionCode: q.code,
          questionText: q.questionText,
          reason: 'Câu hỏi bắt buộc để đánh giá sơ bộ chưa được trả lời',
        });
      }
    }
  }

  // 2. Evaluate active rules sorted by priorityOrder ASC
  const activeRules = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => a.priorityOrder - b.priorityOrder);

  const matchedRulesSnapshot: AkinatorRuleEvaluationOutput['matchedRulesSnapshot'] = [];
  const matchedCategories: AkinatorRuleEvaluationOutput['outcomeData']['categories'] = [];
  let primaryPriority: PriorityLevel | null = null;

  for (const rule of activeRules) {
    const reqCodes: string[] = Array.isArray(rule.requiredQuestionCodes)
      ? rule.requiredQuestionCodes
      : [];

    // Check if any requiredQuestionCodes for this rule are missing
    let ruleMissingRequired = false;
    for (const code of reqCodes) {
      const val = answersMap.get(code);
      const isPresent =
        val !== undefined &&
        val !== null &&
        val !== '' &&
        !(Array.isArray(val) && val.length === 0);
      if (!isPresent) {
        ruleMissingRequired = true;
        const qDef = questionByCode.get(code);
        // Only record into missingCriteria if not already recorded and if the question wasn't hidden by another branch
        if (
          !missingCriteria.some((m) => m.questionCode === code) &&
          (!qDef || isQuestionEligibleToDisplay(qDef, answersMap))
        ) {
          missingCriteria.push({
            questionCode: code,
            questionText: qDef?.questionText || code,
            reason: `Cần thông tin '${code}' để đối chiếu quy tắc '${rule.name}'`,
          });
        }
      }
    }

    if (ruleMissingRequired) {
      continue;
    }

    const isMatch = evaluateConditionGroup(
      rule.conditions as AkinatorConditionGroup,
      answersMap
    );

    if (isMatch) {
      const outcome = rule.outcomePayload as AkinatorRuleOutcomePayload;
      matchedRulesSnapshot.push({
        ruleId: rule.id,
        ruleCode: rule.code,
        ruleName: rule.name,
        priorityOrder: rule.priorityOrder,
        outcomePayload: outcome,
      });

      matchedCategories.push({
        ruleCode: rule.code,
        ruleName: rule.name,
        categoryCode: outcome.categoryCode,
        categoryLabel: outcome.categoryLabel,
        referenceTitle: outcome.referenceTitle,
        referenceSummary: outcome.referenceSummary,
        suggestedDirections: Array.isArray(outcome.suggestedDirections)
          ? outcome.suggestedDirections
          : [],
        cautionNotes: Array.isArray(outcome.cautionNotes) ? outcome.cautionNotes : [],
        suggestedPriority: outcome.suggestedPriority || null,
      });

      if (!primaryPriority && outcome.suggestedPriority) {
        primaryPriority = outcome.suggestedPriority;
      }

      if (rule.stopOnMatch) {
        break;
      }
    }
  }

  // 3. Determine final evaluationStatus (INSUFFICIENT_DATA vs EVALUATED)
  if (missingCriteria.length > 0) {
    return {
      evaluationStatus: AkinatorEvaluationStatus.INSUFFICIENT_DATA,
      summaryTitle: 'Chưa đủ thông tin để đưa ra nhận định tham khảo đầy đủ',
      summaryDescription:
        'Hệ thống ghi nhận một số thông tin trọng yếu chưa được cung cấp đầy đủ. Hồ sơ của bạn đã được lưu lại để chuyên viên KTEA hỗ trợ rà soát và tư vấn trực tiếp.',
      outcomeData: {
        categories: matchedCategories,
        primaryPriority,
        isReferenceOnly: true,
      },
      missingCriteria,
      matchedRulesSnapshot,
      answersSnapshot,
      disclaimerText: disclaimer,
    };
  }

  if (matchedCategories.length === 0) {
    return {
      evaluationStatus: AkinatorEvaluationStatus.EVALUATED,
      summaryTitle: 'Đã tiếp nhận thông tin nhu cầu sơ bộ',
      summaryDescription:
        'Thông tin của bạn đã được ghi nhận. Trường hợp của bạn cần được chuyên viên phân tích chi tiết hơn để có định hướng phù hợp.',
      outcomeData: {
        categories: [],
        primaryPriority: PriorityLevel.CHUA_CO_NHU_CAU,
        isReferenceOnly: true,
      },
      missingCriteria: [],
      matchedRulesSnapshot: [],
      answersSnapshot,
      disclaimerText: disclaimer,
    };
  }

  const primary = matchedCategories[0];
  return {
    evaluationStatus: AkinatorEvaluationStatus.EVALUATED,
    summaryTitle: primary.referenceTitle,
    summaryDescription: primary.referenceSummary,
    outcomeData: {
      categories: matchedCategories,
      primaryPriority: primaryPriority || PriorityLevel.CHUA_CO_NHU_CAU,
      isReferenceOnly: true,
    },
    missingCriteria: [],
    matchedRulesSnapshot,
    answersSnapshot,
    disclaimerText: disclaimer,
  };
}

function disclaimerTextOrDefault(text?: string | null): string {
  if (text && text.trim().length > 0) {
    return text.trim();
  }
  return DEFAULT_AKINATOR_DISCLAIMER;
}

/**
 * Validates configuration integrity (questions + rules) before saving/publishing:
 * - Duplicate question codes or rule codes
 * - At least 1 active entry question (`isEntryQuestion = true`)
 * - All question codes referenced in `visibilityConditions`, `nextQuestionRules`, and `rules` must exist
 * - No circular dependency loops in `visibilityConditions` or `nextQuestionRules`
 */
export function validateAkinatorConfigIntegrity(params: {
  questions: Array<{
    code: string;
    active: boolean;
    isEntryQuestion: boolean;
    visibilityConditions?: AkinatorConditionGroup | null;
    nextQuestionRules?: AkinatorNextQuestionRule[] | null;
  }>;
  rules: Array<{
    code: string;
    active: boolean;
    requiredQuestionCodes?: string[];
    conditions?: AkinatorConditionGroup | null;
  }>;
  requireRules?: boolean;
}): { isValid: boolean; errors: string[]; warnings: string[] } {
  const { questions, rules, requireRules = false } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  const qCodeSet = new Set<string>();
  for (const q of questions) {
    if (qCodeSet.has(q.code)) {
      errors.push(`Mã câu hỏi '${q.code}' bị trùng lặp trong cùng phiên bản cấu hình`);
    }
    qCodeSet.add(q.code);
  }

  const activeEntryQuestions = questions.filter((q) => q.active && q.isEntryQuestion);
  if (activeEntryQuestions.length === 0) {
    errors.push('Cấu hình phải có ít nhất 1 câu hỏi mở đầu đang kích hoạt (isEntryQuestion = true)');
  }

  // Validate question references and build directed graph for cycle detection
  const adj = new Map<string, Set<string>>();
  for (const q of questions) {
    adj.set(q.code, new Set());
  }

  for (const q of questions) {
    if (q.visibilityConditions?.conditions) {
      for (const c of q.visibilityConditions.conditions) {
        if (!qCodeSet.has(c.questionCode)) {
          errors.push(
            `Câu hỏi '${q.code}' có điều kiện hiển thị tham chiếu đến mã câu hỏi không tồn tại '${c.questionCode}'`
          );
        } else if (c.questionCode === q.code) {
          errors.push(`Câu hỏi '${q.code}' không thể tự tham chiếu chính nó trong điều kiện hiển thị`);
        } else {
          // c.questionCode must be answered before q.code
          adj.get(c.questionCode)?.add(q.code);
        }
      }
    }

    if (Array.isArray(q.nextQuestionRules)) {
      for (const br of q.nextQuestionRules) {
        for (const c of br.conditions || []) {
          if (!qCodeSet.has(c.questionCode)) {
            errors.push(
              `Quy tắc rẽ nhánh của câu hỏi '${q.code}' tham chiếu đến mã câu hỏi không tồn tại '${c.questionCode}'`
            );
          }
        }
        if (br.action === 'GOTO_QUESTION') {
          if (!br.targetQuestionCode || !qCodeSet.has(br.targetQuestionCode)) {
            errors.push(
              `Quy tắc rẽ nhánh của câu hỏi '${q.code}' trỏ tới câu hỏi đích không tồn tại '${br.targetQuestionCode || ''}'`
            );
          } else if (br.targetQuestionCode === q.code) {
            errors.push(`Quy tắc rẽ nhánh của câu hỏi '${q.code}' không được trỏ vòng lại chính nó`);
          } else {
            adj.get(q.code)?.add(br.targetQuestionCode);
          }
        }
      }
    }
  }

  // Cycle detection using DFS (0 = unvisited, 1 = visiting, 2 = visited)
  const visitState = new Map<string, number>();
  let hasCycle = false;

  const dfs = (node: string, path: string[]) => {
    visitState.set(node, 1);
    const neighbors = adj.get(node) || new Set();
    for (const next of neighbors) {
      const state = visitState.get(next) || 0;
      if (state === 1) {
        hasCycle = true;
        errors.push(`Phát hiện vòng lặp phụ thuộc/rẽ nhánh câu hỏi: ${[...path, next].join(' -> ')}`);
        return;
      }
      if (state === 0) {
        dfs(next, [...path, next]);
      }
    }
    visitState.set(node, 2);
  };

  for (const code of qCodeSet) {
    if ((visitState.get(code) || 0) === 0 && !hasCycle) {
      dfs(code, [code]);
    }
  }

  // Validate rules
  const rCodeSet = new Set<string>();
  for (const r of rules) {
    if (rCodeSet.has(r.code)) {
      errors.push(`Mã quy tắc '${r.code}' bị trùng lặp trong cùng phiên bản cấu hình`);
    }
    rCodeSet.add(r.code);

    for (const reqCode of r.requiredQuestionCodes || []) {
      if (!qCodeSet.has(reqCode)) {
        errors.push(
          `Quy tắc '${r.code}' yêu cầu mã câu hỏi không tồn tại '${reqCode}' trong requiredQuestionCodes`
        );
      }
    }

    if (r.conditions?.conditions) {
      for (const c of r.conditions.conditions) {
        if (!qCodeSet.has(c.questionCode)) {
          errors.push(
            `Quy tắc '${r.code}' có điều kiện tham chiếu đến mã câu hỏi không tồn tại '${c.questionCode}'`
          );
        }
      }
    }
  }

  if (requireRules && rules.filter((r) => r.active).length === 0) {
    errors.push('Phải có ít nhất 1 quy tắc đánh giá đang kích hoạt (active = true) để xuất bản cấu hình');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
