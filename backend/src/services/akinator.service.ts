import crypto from 'crypto';
import prisma from '../config/database.js';
import {
  AkinatorConfigStatus,
  AkinatorCustomerFieldMapping,
  AkinatorQuizStatus,
  AkinatorWorkflowStatus,
  AkinatorEvaluationStatus,
  Gender,
  PriorityLevel,
  CustomerStatus,
} from '@prisma/client';
import {
  akinatorRepository,
  CreateAkinatorDraftInput,
  SaveAkinatorQuestionInput,
  SaveAkinatorRuleInput,
} from '../repositories/akinator.repository.js';
import {
  selectNextQuestion,
  isQuestionEligibleToDisplay,
  validateAndNormalizeQuizAnswer,
  evaluateAkinatorRules,
  validateAkinatorConfigIntegrity,
  AkinatorQuestionDef,
  AkinatorAnsweredRecord,
} from './akinatorEngine.service.js';
import { auditLogService } from './auditLog.service.js';
import { parseStrictDateOnly } from '../utils/dateUtils.js';
import { buildPaginationMeta } from '../utils/db.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.js';

export interface AkinatorActorContext {
  userId?: string;
  email?: string;
}

export function hashAkinatorSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateAkinatorSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Normalizes phone numbers (especially Vietnamese format) for consistent querying and storage:
 * e.g., '+84912345678', '84912345678', '091 234 5678' -> '0912345678'
 */
export function normalizePhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.replace(/[^\d+]/g, '').trim();
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Returns phone number search variants to catch existing customer records in CRM
 * regardless of whether stored with leading 0, +84, 84, or spaces/dashes.
 */
export function getPhoneSearchVariants(rawPhone: string | null | undefined): string[] {
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) return [];
  const set = new Set<string>();
  set.add(normalized);
  if (rawPhone && rawPhone.trim()) {
    set.add(rawPhone.trim());
  }
  if (normalized.startsWith('0') && normalized.length === 10) {
    const withoutZero = normalized.slice(1);
    set.add(`84${withoutZero}`);
    set.add(`+84${withoutZero}`);
    set.add(`0${withoutZero.slice(0, 3)} ${withoutZero.slice(3, 6)} ${withoutZero.slice(6)}`);
    set.add(`0${withoutZero.slice(0, 3)}-${withoutZero.slice(3, 6)}-${withoutZero.slice(6)}`);
  }
  return Array.from(set);
}

/**
 * Valid Workflow Transitions:
 * In Phase 6, `TRANSFERRED` is enabled from `APPROVED` via the dedicated atomic transfer workflow.
 */
export const ALLOWED_WORKFLOW_TRANSITIONS: Record<
  AkinatorWorkflowStatus,
  AkinatorWorkflowStatus[]
> = {
  [AkinatorWorkflowStatus.PENDING_PROCESSING]: [
    AkinatorWorkflowStatus.IN_PROGRESS,
    AkinatorWorkflowStatus.REJECTED,
  ],
  [AkinatorWorkflowStatus.IN_PROGRESS]: [
    AkinatorWorkflowStatus.NEEDS_MORE_INFO,
    AkinatorWorkflowStatus.PENDING_APPROVAL,
    AkinatorWorkflowStatus.APPROVED,
    AkinatorWorkflowStatus.REJECTED,
  ],
  [AkinatorWorkflowStatus.NEEDS_MORE_INFO]: [
    AkinatorWorkflowStatus.IN_PROGRESS,
    AkinatorWorkflowStatus.REJECTED,
  ],
  [AkinatorWorkflowStatus.PENDING_APPROVAL]: [
    AkinatorWorkflowStatus.APPROVED,
    AkinatorWorkflowStatus.NEEDS_MORE_INFO,
    AkinatorWorkflowStatus.REJECTED,
  ],
  [AkinatorWorkflowStatus.APPROVED]: [
    AkinatorWorkflowStatus.IN_PROGRESS,
    AkinatorWorkflowStatus.TRANSFERRED,
  ],
  [AkinatorWorkflowStatus.REJECTED]: [
    AkinatorWorkflowStatus.IN_PROGRESS,
  ],
  [AkinatorWorkflowStatus.TRANSFERRED]: [],
};

/**
 * Sanitizes a question definition before returning to public quiz client
 * so internal branching/scoring rules are not leaked to unauthenticated clients.
 */
function sanitizePublicQuestion(q: AkinatorQuestionDef | null) {
  if (!q) return null;
  return {
    id: q.id,
    code: q.code,
    questionText: q.questionText,
    description: q.description ?? null,
    questionType: q.questionType,
    options: q.options ?? null,
    validationConfig: q.validationConfig ?? null,
  };
}

/**
 * Sanitizes preliminary result for public quiz display.
 */
function sanitizePublicResult(result: any) {
  if (!result) return null;
  return {
    id: result.id,
    evaluationStatus: result.evaluationStatus,
    summaryTitle: result.summaryTitle,
    summaryDescription: result.summaryDescription,
    outcomeData: result.outcomeData,
    missingCriteria: result.missingCriteria,
    disclaimerText: result.disclaimerText,
    generatedAt: result.generatedAt,
  };
}

export const akinatorService = {
  // =========================================================================
  // A. AKINATOR CONFIGURATION MANAGEMENT (ADMIN ONLY)
  // =========================================================================

  async listConfigs(status?: AkinatorConfigStatus) {
    return akinatorRepository.listConfigVersions(status);
  },

  async getConfigById(versionId: string) {
    const config = await akinatorRepository.findConfigVersionById(versionId);
    if (!config) {
      throw new NotFoundError(`Không tìm thấy phiên bản cấu hình Akinator với ID: ${versionId}`);
    }
    return config;
  },

  async getCurrentPublishedConfig() {
    const config = await akinatorRepository.findCurrentPublishedConfig();
    if (!config) {
      throw new NotFoundError('Hiện chưa có phiên bản cấu hình Akinator nào được xuất bản');
    }
    return config;
  },

  async createDraftConfig(input: CreateAkinatorDraftInput, actor?: AkinatorActorContext) {
    if (input.sourceVersionId) {
      const source = await akinatorRepository.findConfigVersionById(input.sourceVersionId);
      if (!source) {
        throw new NotFoundError(`Không tìm thấy phiên bản nguồn để sao chép: ${input.sourceVersionId}`);
      }
    }

    const created = await akinatorRepository.createDraftConfig({
      ...input,
      createdById: actor?.userId || null,
    });

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'CREATE_AKINATOR_DRAFT_CONFIG',
      entityType: 'AKINATOR_CONFIG_VERSION',
      entityId: created.id,
      details: {
        versionNumber: created.versionNumber,
        title: created.title,
        sourceVersionId: input.sourceVersionId || null,
      },
    });

    return created;
  },

  async updateDraftMetadata(
    versionId: string,
    data: {
      title?: string;
      description?: string | null;
      maxQuestionsPerSession?: number;
      disclaimerText?: string;
      changeLog?: string | null;
    },
    actor?: AkinatorActorContext
  ) {
    const existing = await this.getConfigById(versionId);
    if (existing.status !== AkinatorConfigStatus.DRAFT) {
      throw new BadRequestError(
        'Không thể chỉnh sửa phiên bản cấu hình đã xuất bản hoặc đã lưu trữ. Vui lòng tạo bản nháp mới.'
      );
    }

    const updated = await akinatorRepository.updateDraftMetadata(versionId, data);

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'UPDATE_AKINATOR_DRAFT_METADATA',
      entityType: 'AKINATOR_CONFIG_VERSION',
      entityId: versionId,
      details: {
        versionNumber: updated.versionNumber,
        title: updated.title,
      },
    });

    return updated;
  },

  async saveDraftQuestions(
    versionId: string,
    questions: SaveAkinatorQuestionInput[],
    actor?: AkinatorActorContext
  ) {
    const existing = await this.getConfigById(versionId);
    if (existing.status !== AkinatorConfigStatus.DRAFT) {
      throw new BadRequestError(
        'Không thể chỉnh sửa câu hỏi của phiên bản đã xuất bản hoặc đã lưu trữ. Phiên bản đã xuất bản là bất biến.'
      );
    }

    // Validate question integrity (no duplicate codes, valid branching references, no cycles)
    const check = validateAkinatorConfigIntegrity({
      questions: questions.map((q) => ({
        code: q.code,
        active: q.active !== undefined ? Boolean(q.active) : true,
        isEntryQuestion: Boolean(q.isEntryQuestion),
        visibilityConditions: q.visibilityConditions,
        nextQuestionRules: q.nextQuestionRules,
      })),
      rules: [],
      requireRules: false,
    });

    if (!check.isValid) {
      throw new BadRequestError(`Cấu hình câu hỏi không hợp lệ: ${check.errors.join('; ')}`);
    }

    const updated = await akinatorRepository.saveDraftQuestions(versionId, questions);

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'SAVE_AKINATOR_DRAFT_QUESTIONS',
      entityType: 'AKINATOR_CONFIG_VERSION',
      entityId: versionId,
      details: {
        versionNumber: updated.versionNumber,
        questionCount: questions.length,
      },
    });

    return updated;
  },

  async saveDraftRules(
    versionId: string,
    rules: SaveAkinatorRuleInput[],
    actor?: AkinatorActorContext
  ) {
    const existing = await this.getConfigById(versionId);
    if (existing.status !== AkinatorConfigStatus.DRAFT) {
      throw new BadRequestError(
        'Không thể chỉnh sửa quy tắc của phiên bản đã xuất bản hoặc đã lưu trữ. Phiên bản đã xuất bản là bất biến.'
      );
    }

    const check = validateAkinatorConfigIntegrity({
      questions: existing.questions.map((q) => ({
        code: q.code,
        active: q.active,
        isEntryQuestion: q.isEntryQuestion,
        visibilityConditions: q.visibilityConditions as any,
        nextQuestionRules: q.nextQuestionRules as any,
      })),
      rules: rules.map((r) => ({
        code: r.code,
        active: r.active !== undefined ? Boolean(r.active) : true,
        requiredQuestionCodes: r.requiredQuestionCodes,
        conditions: r.conditions,
      })),
      requireRules: true,
    });

    if (!check.isValid) {
      throw new BadRequestError(`Cấu hình quy tắc không hợp lệ: ${check.errors.join('; ')}`);
    }

    const updated = await akinatorRepository.saveDraftRules(versionId, rules);

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'SAVE_AKINATOR_DRAFT_RULES',
      entityType: 'AKINATOR_CONFIG_VERSION',
      entityId: versionId,
      details: {
        versionNumber: updated.versionNumber,
        ruleCount: rules.length,
      },
    });

    return updated;
  },

  async validateConfigVersion(versionId: string) {
    const config = await this.getConfigById(versionId);
    return validateAkinatorConfigIntegrity({
      questions: config.questions.map((q) => ({
        code: q.code,
        active: q.active,
        isEntryQuestion: q.isEntryQuestion,
        visibilityConditions: q.visibilityConditions as any,
        nextQuestionRules: q.nextQuestionRules as any,
      })),
      rules: config.rules.map((r) => ({
        code: r.code,
        active: r.active,
        requiredQuestionCodes: r.requiredQuestionCodes as any,
        conditions: r.conditions as any,
      })),
      requireRules: true,
    });
  },

  async publishConfigVersion(
    versionId: string,
    changeLog?: string | null,
    actor?: AkinatorActorContext
  ) {
    const existing = await this.getConfigById(versionId);
    if (existing.status === AkinatorConfigStatus.PUBLISHED && existing.isCurrent) {
      throw new BadRequestError('Phiên bản cấu hình này đã được xuất bản và đang là phiên bản hiện hành');
    }
    if (existing.status === AkinatorConfigStatus.ARCHIVED) {
      throw new BadRequestError(
        'Không thể xuất bản lại phiên bản đã lưu trữ. Vui lòng sao chép sang bản nháp mới.'
      );
    }

    const validation = await this.validateConfigVersion(versionId);
    if (!validation.isValid) {
      throw new BadRequestError(
        `Không thể xuất bản cấu hình Akinator do chưa hợp lệ: ${validation.errors.join('; ')}`
      );
    }

    const published = await akinatorRepository.publishConfigVersion(
      versionId,
      actor?.userId || null,
      changeLog
    );

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'PUBLISH_AKINATOR_CONFIG',
      entityType: 'AKINATOR_CONFIG_VERSION',
      entityId: versionId,
      details: {
        versionNumber: published.versionNumber,
        title: published.title,
      },
    });

    return published;
  },

  // =========================================================================
  // B. PUBLIC QUIZ SESSIONS (TOKEN-SCOPED, NO CRM MUTATION)
  // =========================================================================

  async startQuizSession() {
    const publishedConfig = await akinatorRepository.findCurrentPublishedConfig();
    if (!publishedConfig) {
      throw new BadRequestError('Hiện chưa có bộ câu hỏi Akinator nào được xuất bản');
    }

    const rawToken = generateAkinatorSessionToken();
    const tokenHash = hashAkinatorSessionToken(rawToken);

    const session = await akinatorRepository.createSession({
      sessionTokenHash: tokenHash,
      configVersionId: publishedConfig.id,
    });

    const selection = selectNextQuestion({
      questions: publishedConfig.questions as unknown as AkinatorQuestionDef[],
      answeredRecords: [],
      maxQuestionsPerSession: publishedConfig.maxQuestionsPerSession,
    });

    return {
      sessionToken: rawToken,
      sessionId: session.id,
      quizStatus: session.quizStatus,
      configVersionNumber: publishedConfig.versionNumber,
      title: publishedConfig.title,
      description: publishedConfig.description,
      disclaimerText: publishedConfig.disclaimerText,
      nextQuestion: sanitizePublicQuestion(selection.nextQuestion),
      readyToComplete: selection.readyToComplete,
      progress: selection.progress,
    };
  },

  async getQuizSessionByToken(rawToken: string) {
    const tokenHash = hashAkinatorSessionToken(rawToken);
    const session = await akinatorRepository.findSessionByTokenHash(tokenHash);
    if (!session) {
      throw new NotFoundError('Phiên làm quiz không tồn tại hoặc không hợp lệ');
    }

    if (session.quizStatus === AkinatorQuizStatus.COMPLETED) {
      return {
        sessionId: session.id,
        quizStatus: session.quizStatus,
        configVersionNumber: session.configVersion.versionNumber,
        title: session.configVersion.title,
        completedAt: session.completedAt,
        nextQuestion: null,
        readyToComplete: false,
        result: sanitizePublicResult(session.result),
      };
    }

    const answeredRecords: AkinatorAnsweredRecord[] = session.rawAnswers.map((a) => ({
      questionId: a.questionId,
      questionCode: a.questionCode,
      answerValue: a.answerValue,
      stepOrder: a.stepOrder,
    }));

    const selection = selectNextQuestion({
      questions: session.configVersion.questions as unknown as AkinatorQuestionDef[],
      answeredRecords,
      maxQuestionsPerSession: session.configVersion.maxQuestionsPerSession,
    });

    return {
      sessionId: session.id,
      quizStatus: session.quizStatus,
      configVersionNumber: session.configVersion.versionNumber,
      title: session.configVersion.title,
      description: session.configVersion.description,
      disclaimerText: session.configVersion.disclaimerText,
      answeredQuestions: session.rawAnswers.map((a) => ({
        questionCode: a.questionCode,
        questionText: a.questionTextSnapshot,
        answerValue: a.answerValue,
        answerLabel: a.answerLabelSnapshot,
        stepOrder: a.stepOrder,
      })),
      nextQuestion: sanitizePublicQuestion(selection.nextQuestion),
      readyToComplete: selection.readyToComplete,
      progress: selection.progress,
    };
  },

  async submitQuizAnswer(
    rawToken: string,
    payload: { questionCode: string; answerValue: any }
  ) {
    const tokenHash = hashAkinatorSessionToken(rawToken);
    const session = await akinatorRepository.findSessionByTokenHash(tokenHash);
    if (!session) {
      throw new NotFoundError('Phiên làm quiz không tồn tại hoặc không hợp lệ');
    }

    if (session.quizStatus !== AkinatorQuizStatus.IN_PROGRESS) {
      throw new BadRequestError(
        'Phiên làm quiz này đã kết thúc, không thể gửi hoặc sửa câu trả lời'
      );
    }

    const questions = session.configVersion.questions as unknown as AkinatorQuestionDef[];
    const targetQuestion = questions.find((q) => q.active && q.code === payload.questionCode);
    if (!targetQuestion) {
      throw new BadRequestError(
        `Câu hỏi '${payload.questionCode}' không tồn tại trong phiên bản cấu hình của phiên này`
      );
    }

    // Build current answers map (excluding the question being answered if it's a duplicate retry of the same step)
    const priorAnswers = session.rawAnswers.filter((a) => a.questionCode !== payload.questionCode);
    const priorMap = new Map<string, any>();
    for (const a of priorAnswers) {
      priorMap.set(a.questionCode, a.answerValue);
    }

    // Enforce visibility conditions: cannot submit an answer to a question belonging to an ineligible branch
    if (!isQuestionEligibleToDisplay(targetQuestion, priorMap)) {
      throw new BadRequestError(
        `Câu hỏi '${targetQuestion.code}' không phù hợp với nhánh câu trả lời hiện tại`
      );
    }

    // Validate & normalize answer value according to questionType
    const { normalizedValue, labelSnapshot } = validateAndNormalizeQuizAnswer(
      targetQuestion,
      payload.answerValue
    );

    // Compute selection reason for audit traceability
    const currentSelection = selectNextQuestion({
      questions,
      answeredRecords: priorAnswers.map((a) => ({
        questionId: a.questionId,
        questionCode: a.questionCode,
        answerValue: a.answerValue,
        stepOrder: a.stepOrder,
      })),
      maxQuestionsPerSession: session.configVersion.maxQuestionsPerSession,
    });

    const existingAnswer = session.rawAnswers.find((a) => a.questionCode === targetQuestion.code);
    const nextStepOrder = existingAnswer
      ? existingAnswer.stepOrder
      : session.rawAnswers.length + 1;

    // Extract contact field if question maps to a customer contact attribute
    const sessionContactUpdate: {
      rawFullName?: string;
      rawPhone?: string;
      rawEmail?: string;
    } = {};

    if (targetQuestion.mapsToCustomerField === AkinatorCustomerFieldMapping.FULL_NAME) {
      sessionContactUpdate.rawFullName = String(normalizedValue).trim();
    } else if (targetQuestion.mapsToCustomerField === AkinatorCustomerFieldMapping.PHONE) {
      sessionContactUpdate.rawPhone = String(normalizedValue).trim();
    } else if (targetQuestion.mapsToCustomerField === AkinatorCustomerFieldMapping.EMAIL) {
      sessionContactUpdate.rawEmail = String(normalizedValue).trim();
    }

    await prisma.$transaction(async (tx) => {
      await tx.akinatorRawAnswer.upsert({
        where: {
          akinator_session_question_code_unique: {
            sessionId: session.id,
            questionCode: targetQuestion.code,
          },
        },
        create: {
          sessionId: session.id,
          questionId: targetQuestion.id,
          questionCode: targetQuestion.code,
          questionTextSnapshot: targetQuestion.questionText,
          answerValue: normalizedValue,
          answerLabelSnapshot: labelSnapshot,
          selectionReason: currentSelection.selectionReason,
          stepOrder: nextStepOrder,
        },
        update: {
          answerValue: normalizedValue,
          answerLabelSnapshot: labelSnapshot,
        },
      });

      if (Object.keys(sessionContactUpdate).length > 0) {
        await tx.akinatorSession.update({
          where: { id: session.id },
          data: sessionContactUpdate,
        });
      }
    });

    // Reload updated answers and compute next question
    const updatedSession = await akinatorRepository.findSessionByTokenHash(tokenHash);
    const updatedAnsweredRecords: AkinatorAnsweredRecord[] = (updatedSession?.rawAnswers || []).map(
      (a) => ({
        questionId: a.questionId,
        questionCode: a.questionCode,
        answerValue: a.answerValue,
        stepOrder: a.stepOrder,
      })
    );

    const nextSelection = selectNextQuestion({
      questions,
      answeredRecords: updatedAnsweredRecords,
      maxQuestionsPerSession: session.configVersion.maxQuestionsPerSession,
    });

    return {
      sessionId: session.id,
      quizStatus: session.quizStatus,
      savedAnswer: {
        questionCode: targetQuestion.code,
        answerValue: normalizedValue,
        answerLabel: labelSnapshot,
        stepOrder: nextStepOrder,
      },
      nextQuestion: sanitizePublicQuestion(nextSelection.nextQuestion),
      readyToComplete: nextSelection.readyToComplete,
      selectionReason: nextSelection.selectionReason,
      progress: nextSelection.progress,
    };
  },

  async completeQuizSession(rawToken: string) {
    const tokenHash = hashAkinatorSessionToken(rawToken);
    const session = await akinatorRepository.findSessionByTokenHash(tokenHash);
    if (!session) {
      throw new NotFoundError('Phiên làm quiz không tồn tại hoặc không hợp lệ');
    }

    // Idempotent handling: if already COMPLETED, return existing result without duplicating records
    if (session.quizStatus === AkinatorQuizStatus.COMPLETED && session.result) {
      return {
        sessionId: session.id,
        quizStatus: session.quizStatus,
        completedAt: session.completedAt,
        result: sanitizePublicResult(session.result),
        alreadyCompleted: true,
      };
    }

    if (session.rawAnswers.length === 0) {
      throw new BadRequestError('Cần trả lời ít nhất 1 câu hỏi trước khi hoàn tất phiên quiz');
    }

    const questions = session.configVersion.questions as unknown as AkinatorQuestionDef[];
    const answeredRecords: AkinatorAnsweredRecord[] = session.rawAnswers.map((a) => ({
      questionId: a.questionId,
      questionCode: a.questionCode,
      answerValue: a.answerValue,
      stepOrder: a.stepOrder,
    }));

    const evaluation = evaluateAkinatorRules({
      questions,
      rules: session.configVersion.rules as any,
      answeredRecords,
      disclaimerText: session.configVersion.disclaimerText,
    });

    // Extract initial contact fields from raw answers mapped to customer fields (for Admin Review initialization)
    let initName = session.rawFullName || null;
    let initPhone = session.rawPhone || null;
    let initEmail = session.rawEmail || null;
    let initDob: Date | null = null;
    let initGender: Gender | null = null;
    let initAddress: string | null = null;

    for (const q of questions) {
      const ans = session.rawAnswers.find((a) => a.questionCode === q.code);
      if (!ans) continue;
      const val = ans.answerValue;
      if (q.mapsToCustomerField === AkinatorCustomerFieldMapping.FULL_NAME && !initName) {
        initName = String(val).trim();
      } else if (q.mapsToCustomerField === AkinatorCustomerFieldMapping.PHONE && !initPhone) {
        initPhone = String(val).trim();
      } else if (q.mapsToCustomerField === AkinatorCustomerFieldMapping.EMAIL && !initEmail) {
        initEmail = String(val).trim();
      } else if (q.mapsToCustomerField === AkinatorCustomerFieldMapping.DOB) {
        const parsed = parseStrictDateOnly(String(val));
        if (parsed) initDob = parsed.utcNoonDate;
      } else if (q.mapsToCustomerField === AkinatorCustomerFieldMapping.GENDER) {
        const gStr = String(val).toUpperCase();
        if (gStr === 'MALE' || gStr === 'FEMALE' || gStr === 'OTHER') {
          initGender = gStr as Gender;
        }
      } else if (q.mapsToCustomerField === AkinatorCustomerFieldMapping.ADDRESS) {
        initAddress = String(val).trim();
      }
    }

    const completedAtNow = new Date();

    const completedResult = await prisma.$transaction(async (tx) => {
      // Double-check inside transaction for race-condition idempotency
      const freshSession = await tx.akinatorSession.findUnique({
        where: { id: session.id },
        include: { result: true },
      });

      if (freshSession?.quizStatus === AkinatorQuizStatus.COMPLETED && freshSession.result) {
        return freshSession.result;
      }

      await tx.akinatorSession.update({
        where: { id: session.id },
        data: {
          quizStatus: AkinatorQuizStatus.COMPLETED,
          workflowStatus: AkinatorWorkflowStatus.PENDING_PROCESSING,
          rawFullName: initName,
          rawPhone: initPhone,
          rawEmail: initEmail,
          completedAt: completedAtNow,
        },
      });

      const createdResult = await tx.akinatorResult.create({
        data: {
          sessionId: session.id,
          configVersionId: session.configVersionId,
          evaluationStatus: evaluation.evaluationStatus,
          summaryTitle: evaluation.summaryTitle,
          summaryDescription: evaluation.summaryDescription,
          outcomeData: evaluation.outcomeData as any,
          missingCriteria: evaluation.missingCriteria as any,
          matchedRulesSnapshot: evaluation.matchedRulesSnapshot as any,
          answersSnapshot: evaluation.answersSnapshot as any,
          disclaimerText: evaluation.disclaimerText,
          generatedAt: completedAtNow,
        },
      });

      await tx.akinatorAdminReview.create({
        data: {
          sessionId: session.id,
          editedFullName: initName,
          editedPhone: initPhone,
          editedEmail: initEmail,
          editedGender: initGender,
          editedDateOfBirth: initDob,
          editedAddress: initAddress,
          editedPriority: evaluation.outcomeData.primaryPriority || null,
        },
      });

      await tx.akinatorStatusHistory.create({
        data: {
          sessionId: session.id,
          fromStatus: null,
          toStatus: AkinatorWorkflowStatus.PENDING_PROCESSING,
          actionType: 'QUIZ_COMPLETED',
          note: 'Khách hàng hoàn thành quiz. Khởi tạo hồ sơ ở trạng thái Chờ xử lý (PENDING_PROCESSING).',
        },
      });

      return createdResult;
    });

    return {
      sessionId: session.id,
      quizStatus: AkinatorQuizStatus.COMPLETED,
      completedAt: completedAtNow,
      result: sanitizePublicResult(completedResult),
      alreadyCompleted: false,
    };
  },

  // =========================================================================
  // C. ADMIN REVIEW & WORKFLOW MANAGEMENT (ADMIN ONLY)
  // =========================================================================

  async listSessionsForAdmin(query: {
    page?: number;
    pageSize?: number;
    quizStatus?: AkinatorQuizStatus;
    workflowStatus?: AkinatorWorkflowStatus;
    evaluationStatus?: AkinatorEvaluationStatus;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    let fromDateObj: Date | undefined;
    let toDateObj: Date | undefined;

    if (query.fromDate) {
      const parsedFrom = parseStrictDateOnly(query.fromDate);
      if (!parsedFrom) {
        throw new BadRequestError('Tham số fromDate không hợp lệ (dd/MM/yyyy hoặc yyyy-MM-dd)');
      }
      fromDateObj = new Date(`${parsedFrom.isoDate}T00:00:00.000Z`);
    }

    if (query.toDate) {
      const parsedTo = parseStrictDateOnly(query.toDate);
      if (!parsedTo) {
        throw new BadRequestError('Tham số toDate không hợp lệ (dd/MM/yyyy hoặc yyyy-MM-dd)');
      }
      toDateObj = new Date(`${parsedTo.isoDate}T23:59:59.999Z`);
    }

    const { total, items } = await akinatorRepository.findSessionsForAdmin({
      page,
      pageSize,
      quizStatus: query.quizStatus,
      workflowStatus: query.workflowStatus,
      evaluationStatus: query.evaluationStatus,
      search: query.search,
      fromDate: fromDateObj,
      toDate: toDateObj,
    });

    return {
      items: items.map((s) => {
        const { sessionTokenHash: _omit, ...safeSession } = s;
        return safeSession;
      }),
      pagination: buildPaginationMeta(total, page, pageSize),
    };
  },

  async getSessionDetailForAdmin(id: string) {
    const session = await akinatorRepository.findSessionDetailById(id);
    if (!session) {
      throw new NotFoundError(`Không tìm thấy hồ sơ Akinator với ID: ${id}`);
    }
    const { sessionTokenHash: _omit, ...safeSession } = session;
    return safeSession;
  },

  /**
   * Updates editable Admin review data in `AkinatorAdminReview`.
   * Strictly preserves `AkinatorRawAnswer` untouched.
   */
  async updateAdminReview(
    sessionId: string,
    data: {
      editedFullName?: string | null;
      editedPhone?: string | null;
      editedEmail?: string | null;
      editedGender?: Gender | null;
      editedDateOfBirth?: string | null;
      editedAddress?: string | null;
      editedSource?: string | null;
      editedPriority?: PriorityLevel | null;
      processorNote?: string | null;
      missingInfoNote?: string | null;
      approvalNote?: string | null;
    },
    actor: AkinatorActorContext
  ) {
    const session = await akinatorRepository.findSessionDetailById(sessionId);
    if (!session) {
      throw new NotFoundError(`Không tìm thấy hồ sơ Akinator với ID: ${sessionId}`);
    }

    if (session.quizStatus !== AkinatorQuizStatus.COMPLETED || !session.workflowStatus) {
      throw new BadRequestError('Chỉ có thể cập nhật dữ liệu xử lý cho phiên quiz đã hoàn thành');
    }

    if (session.workflowStatus === AkinatorWorkflowStatus.TRANSFERRED) {
      throw new BadRequestError('Hồ sơ đã chuyển sang Khách hàng, không thể chỉnh sửa dữ liệu xử lý');
    }

    let parsedDob: Date | null | undefined = undefined;
    if (data.editedDateOfBirth !== undefined) {
      if (data.editedDateOfBirth === null || data.editedDateOfBirth.trim() === '') {
        parsedDob = null;
      } else {
        const strictDob = parseStrictDateOnly(data.editedDateOfBirth);
        if (!strictDob) {
          throw new BadRequestError('Ngày sinh không hợp lệ');
        }
        parsedDob = strictDob.utcNoonDate;
      }
    }

    const updatePayload: Record<string, any> = {};
    if (data.editedFullName !== undefined) updatePayload.editedFullName = data.editedFullName;
    if (data.editedPhone !== undefined) updatePayload.editedPhone = data.editedPhone;
    if (data.editedEmail !== undefined) {
      updatePayload.editedEmail = data.editedEmail === '' ? null : data.editedEmail;
    }
    if (data.editedGender !== undefined) updatePayload.editedGender = data.editedGender;
    if (parsedDob !== undefined) updatePayload.editedDateOfBirth = parsedDob;
    if (data.editedAddress !== undefined) updatePayload.editedAddress = data.editedAddress;
    if (data.editedSource !== undefined) updatePayload.editedSource = data.editedSource;
    if (data.editedPriority !== undefined) updatePayload.editedPriority = data.editedPriority;
    if (data.processorNote !== undefined) updatePayload.processorNote = data.processorNote;
    if (data.missingInfoNote !== undefined) updatePayload.missingInfoNote = data.missingInfoNote;
    if (data.approvalNote !== undefined) updatePayload.approvalNote = data.approvalNote;

    if (!session.adminReview?.assignedAdminId && actor.userId) {
      updatePayload.assignedAdminId = actor.userId;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const review = await tx.akinatorAdminReview.upsert({
        where: { sessionId },
        create: {
          sessionId,
          ...updatePayload,
        },
        update: updatePayload,
      });

      await tx.akinatorStatusHistory.create({
        data: {
          sessionId,
          fromStatus: session.workflowStatus,
          toStatus: session.workflowStatus!,
          actionType: 'UPDATE_ADMIN_REVIEW',
          changedFieldsSnapshot: Object.keys(updatePayload),
          note: 'Cập nhật thông tin xử lý của Admin (giữ nguyên câu trả lời gốc của khách hàng).',
          actorUserId: actor.userId || null,
          actorEmail: actor.email || null,
        },
      });

      return review;
    });

    await auditLogService.log({
      actorId: actor.userId || undefined,
      actorEmail: actor.email || undefined,
      action: 'UPDATE_AKINATOR_ADMIN_REVIEW',
      entityType: 'AKINATOR_SESSION',
      entityId: sessionId,
      details: {
        updatedFields: Object.keys(updatePayload),
        workflowStatus: session.workflowStatus,
      },
    });

    return updated;
  },

  /**
   * Transitions workflowStatus according to the approved Phase 1 & Phase 2 State Machine.
   */
  async transitionWorkflowStatus(
    sessionId: string,
    input: {
      toStatus: AkinatorWorkflowStatus;
      note?: string | null;
      missingInfoNote?: string | null;
      approvalNote?: string | null;
      rejectionReason?: string | null;
    },
    actor: AkinatorActorContext
  ) {
    const session = await akinatorRepository.findSessionDetailById(sessionId);
    if (!session) {
      throw new NotFoundError(`Không tìm thấy hồ sơ Akinator với ID: ${sessionId}`);
    }

    if (session.quizStatus !== AkinatorQuizStatus.COMPLETED || !session.workflowStatus) {
      throw new BadRequestError('Hồ sơ chưa hoàn tất quiz, không thể chuyển trạng thái xử lý');
    }

    const fromStatus = session.workflowStatus;
    const { toStatus } = input;

    // TRANSFERRED must go through the dedicated atomic transfer workflow (/api/akinator/sessions/:id/transfer)
    if (toStatus === AkinatorWorkflowStatus.TRANSFERRED) {
      throw new ForbiddenError(
        'Chuyển trạng thái sang Đã chuyển (TRANSFERRED) trực tiếp chưa được kích hoạt qua API cập nhật trạng thái thông thường. Bắt buộc phải thực hiện qua luồng kiểm tra trùng và tích hợp khách hàng (POST /api/akinator/sessions/:id/transfer)'
      );
    }

    if (fromStatus === toStatus) {
      throw new BadRequestError(`Hồ sơ đã ở trạng thái ${toStatus}`);
    }

    const allowedTargets = ALLOWED_WORKFLOW_TRANSITIONS[fromStatus] || [];
    if (!allowedTargets.includes(toStatus)) {
      throw new BadRequestError(
        `Không thể chuyển trạng thái từ '${fromStatus}' sang '${toStatus}' (quy trình không hợp lệ)`
      );
    }

    // Specific pre-conditions per target status
    const effectiveFullName =
      session.adminReview?.editedFullName || session.rawFullName || '';
    const effectivePhone =
      session.adminReview?.editedPhone || session.rawPhone || '';

    if (
      toStatus === AkinatorWorkflowStatus.PENDING_APPROVAL ||
      toStatus === AkinatorWorkflowStatus.APPROVED
    ) {
      if (!effectiveFullName.trim() || !effectivePhone.trim()) {
        throw new BadRequestError(
          'Hồ sơ cần có đầy đủ Họ tên và Số điện thoại trong dữ liệu xử lý trước khi Trình duyệt hoặc Phê duyệt'
        );
      }
    }

    if (toStatus === AkinatorWorkflowStatus.NEEDS_MORE_INFO) {
      const effectiveMissingNote =
        input.missingInfoNote || input.note || session.adminReview?.missingInfoNote;
      if (!effectiveMissingNote || !effectiveMissingNote.trim()) {
        throw new BadRequestError(
          'Vui lòng nhập ghi chú thông tin cần bổ sung (missingInfoNote) khi chuyển sang trạng thái Cần bổ sung'
        );
      }
    }

    if (toStatus === AkinatorWorkflowStatus.REJECTED) {
      const effectiveRejection =
        input.rejectionReason || input.note || session.adminReview?.rejectionReason;
      if (!effectiveRejection || !effectiveRejection.trim()) {
        throw new BadRequestError(
          'Vui lòng nhập lý do từ chối (rejectionReason) khi chuyển sang trạng thái Từ chối'
        );
      }
    }

    const now = new Date();
    const reviewUpdate: Record<string, any> = {};

    if (!session.adminReview?.assignedAdminId && actor.userId) {
      reviewUpdate.assignedAdminId = actor.userId;
    }

    if (input.missingInfoNote !== undefined) {
      reviewUpdate.missingInfoNote = input.missingInfoNote;
    }
    if (input.approvalNote !== undefined) {
      reviewUpdate.approvalNote = input.approvalNote;
    }
    if (input.rejectionReason !== undefined) {
      reviewUpdate.rejectionReason = input.rejectionReason;
    }

    if (toStatus === AkinatorWorkflowStatus.APPROVED) {
      reviewUpdate.approvedById = actor.userId || null;
      reviewUpdate.approvedAt = now;
    } else if (fromStatus === AkinatorWorkflowStatus.APPROVED && toStatus === AkinatorWorkflowStatus.IN_PROGRESS) {
      // Reopened from APPROVED -> clear prior approval stamp so it must be re-approved after edits
      reviewUpdate.approvedById = null;
      reviewUpdate.approvedAt = null;
    }

    if (toStatus === AkinatorWorkflowStatus.REJECTED) {
      reviewUpdate.rejectedById = actor.userId || null;
      reviewUpdate.rejectedAt = now;
    }

    await prisma.$transaction(async (tx) => {
      await tx.akinatorSession.update({
        where: { id: sessionId },
        data: {
          workflowStatus: toStatus,
        },
      });

      await tx.akinatorAdminReview.upsert({
        where: { sessionId },
        create: {
          sessionId,
          editedFullName: session.rawFullName,
          editedPhone: session.rawPhone,
          editedEmail: session.rawEmail,
          ...reviewUpdate,
        },
        update: reviewUpdate,
      });

      await tx.akinatorStatusHistory.create({
        data: {
          sessionId,
          fromStatus,
          toStatus,
          actionType: `TRANSITION_TO_${toStatus}`,
          note:
            input.note ||
            input.approvalNote ||
            input.missingInfoNote ||
            input.rejectionReason ||
            `Chuyển trạng thái từ ${fromStatus} sang ${toStatus}`,
          actorUserId: actor.userId || null,
          actorEmail: actor.email || null,
        },
      });
    });

    await auditLogService.log({
      actorId: actor.userId || undefined,
      actorEmail: actor.email || undefined,
      action: 'TRANSITION_AKINATOR_STATUS',
      entityType: 'AKINATOR_SESSION',
      entityId: sessionId,
      details: {
        fromStatus,
        toStatus,
        note: input.note || null,
      },
    });

    return this.getSessionDetailForAdmin(sessionId);
  },

  /**
   * Checks for duplicate customers in the Customer module matching the session's phone number.
   * Returns matching customer records (with basic identifying fields) to allow Admin to choose
   * between linking to existing customer or confirming creation of a new customer.
   */
  async checkDuplicateCustomerForSession(sessionId: string) {
    const session = await akinatorRepository.findSessionDetailById(sessionId);
    if (!session) {
      throw new NotFoundError(`Không tìm thấy hồ sơ Akinator với ID: ${sessionId}`);
    }

    const effectivePhone = session.adminReview?.editedPhone || session.rawPhone || '';
    if (!effectivePhone.trim()) {
      return {
        sessionId: session.id,
        phone: null,
        normalizedPhone: null,
        hasDuplicate: false,
        matches: [],
      };
    }

    const normalized = normalizePhoneNumber(effectivePhone);
    const variants = getPhoneSearchVariants(effectivePhone);

    const matches = await prisma.customer.findMany({
      where: {
        OR: variants.map((v) => ({ phone: v })),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        overallStatus: true,
        priority: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10,
    });

    return {
      sessionId: session.id,
      phone: effectivePhone,
      normalizedPhone: normalized,
      hasDuplicate: matches.length > 0,
      matches,
    };
  },

  /**
   * Transfers an APPROVED Akinator session to the Customer module:
   * - Atomic transaction protecting against race conditions and concurrent double-clicks.
   * - Mode LINK_EXISTING: links session to an existing customer record without overwriting customer data.
   * - Mode CREATE_NEW: creates a new customer record with mapped fields. Requires explicit confirmation if duplicate exists.
   * - Strict idempotency: if session was already TRANSFERRED, returns existing linked customer safely.
   */
  async transferSessionToCustomer(
    sessionId: string,
    input: {
      mode: 'LINK_EXISTING' | 'CREATE_NEW';
      existingCustomerId?: string;
      confirmCreateNew?: boolean;
    },
    actor: AkinatorActorContext
  ) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        return await prisma.$transaction(async (tx) => {
      // 1. Fetch fresh session within transaction
      const session = await tx.akinatorSession.findUnique({
        where: { id: sessionId },
        include: {
          adminReview: true,
          result: true,
        },
      });

      if (!session) {
        throw new NotFoundError(`Không tìm thấy hồ sơ Akinator với ID: ${sessionId}`);
      }

      // 2. Idempotency Check: if already transferred, return existing link safely
      if (session.workflowStatus === AkinatorWorkflowStatus.TRANSFERRED) {
        const linkedId = session.adminReview?.linkedCustomerId;
        const existingCustomer = linkedId
          ? await tx.customer.findUnique({
              where: { id: linkedId },
              select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                overallStatus: true,
                priority: true,
                source: true,
                createdAt: true,
              },
            })
          : null;

        return {
          alreadyTransferred: true,
          sessionId: session.id,
          customerId: existingCustomer?.id || null,
          customer: existingCustomer,
          mode: session.adminReview?.linkedCustomerId ? 'LINKED' : 'TRANSFERRED',
          message: 'Hồ sơ này đã được chuyển sang Khách hàng trước đó',
        };
      }

      // 3. Status pre-condition: Must be APPROVED
      if (session.workflowStatus !== AkinatorWorkflowStatus.APPROVED) {
        throw new BadRequestError(
          `Chỉ hồ sơ ở trạng thái Đã duyệt (APPROVED) mới có thể chuyển sang Khách hàng. Trạng thái hiện tại: ${session.workflowStatus}`
        );
      }

      // 4. Validate required customer fields
      const effectiveFullName =
        session.adminReview?.editedFullName?.trim() || session.rawFullName?.trim() || '';
      const effectivePhone =
        session.adminReview?.editedPhone?.trim() || session.rawPhone?.trim() || '';

      if (!effectiveFullName || !effectivePhone) {
        throw new BadRequestError(
          'Hồ sơ cần có đầy đủ Họ tên và Số điện thoại trong dữ liệu xử lý trước khi chuyển sang Khách hàng'
        );
      }

      const normalizedPhone = normalizePhoneNumber(effectivePhone);
      const searchVariants = getPhoneSearchVariants(effectivePhone);

      // Check duplicates in DB within transaction
      const duplicateMatches = await tx.customer.findMany({
        where: {
          OR: searchVariants.map((v) => ({ phone: v })),
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          overallStatus: true,
        },
      });

      // 5. Handle LINK_EXISTING mode
      if (input.mode === 'LINK_EXISTING') {
        if (!input.existingCustomerId) {
          throw new BadRequestError(
            'Vui lòng chọn khách hàng hiện hữu để liên kết (existingCustomerId)'
          );
        }

        const targetCustomer = await tx.customer.findUnique({
          where: { id: input.existingCustomerId },
        });

        if (!targetCustomer) {
          throw new NotFoundError(
            `Không tìm thấy khách hàng với ID: ${input.existingCustomerId}`
          );
        }

        // Link customer to admin review without altering targetCustomer's existing data
        await tx.akinatorAdminReview.upsert({
          where: { sessionId: session.id },
          create: {
            sessionId: session.id,
            linkedCustomerId: targetCustomer.id,
          },
          update: {
            linkedCustomerId: targetCustomer.id,
          },
        });

        // Update session status to TRANSFERRED
        await tx.akinatorSession.update({
          where: { id: session.id },
          data: {
            workflowStatus: AkinatorWorkflowStatus.TRANSFERRED,
          },
        });

        // Record status history
        await tx.akinatorStatusHistory.create({
          data: {
            sessionId: session.id,
            fromStatus: AkinatorWorkflowStatus.APPROVED,
            toStatus: AkinatorWorkflowStatus.TRANSFERRED,
            actionType: 'TRANSFER_LINK_EXISTING_CUSTOMER',
            note: `Liên kết hồ sơ Akinator với khách hàng hiện hữu: ${targetCustomer.fullName} (${targetCustomer.phone}) - ID: ${targetCustomer.id}. Bảo toàn nguyên vẹn thông tin khách hàng hiện có.`,
            actorUserId: actor.userId || null,
            actorEmail: actor.email || null,
          },
        });

        // Log audit trail
        await auditLogService.log({
          actorId: actor.userId || undefined,
          actorEmail: actor.email || undefined,
          action: 'TRANSFER_AKINATOR_TO_EXISTING_CUSTOMER',
          entityType: 'CUSTOMER',
          entityId: targetCustomer.id,
          details: {
            sessionId: session.id,
            mode: 'LINK_EXISTING',
            customerId: targetCustomer.id,
            customerPhone: targetCustomer.phone,
          },
        });

        return {
          alreadyTransferred: false,
          sessionId: session.id,
          customerId: targetCustomer.id,
          customer: {
            id: targetCustomer.id,
            fullName: targetCustomer.fullName,
            phone: targetCustomer.phone,
            email: targetCustomer.email,
            overallStatus: targetCustomer.overallStatus,
          },
          mode: 'LINK_EXISTING',
          message: `Đã liên kết hồ sơ Akinator với khách hàng hiện hữu: ${targetCustomer.fullName}`,
        };
      }

      // 6. Handle CREATE_NEW mode
      if (input.mode === 'CREATE_NEW') {
        if (duplicateMatches.length > 0 && !input.confirmCreateNew) {
          throw new ConflictError(
            `Phát hiện ${duplicateMatches.length} khách hàng trùng số điện thoại '${effectivePhone}'. Vui lòng xác nhận tạo mới (confirmCreateNew) hoặc chọn liên kết với khách hàng hiện có.`
          );
        }

        // Map fields to Customer record
        const createdCustomer = await tx.customer.create({
          data: {
            fullName: effectiveFullName,
            phone: normalizedPhone || effectivePhone,
            email: session.adminReview?.editedEmail || session.rawEmail || null,
            gender: session.adminReview?.editedGender || null,
            dateOfBirth: session.adminReview?.editedDateOfBirth || null,
            address: session.adminReview?.editedAddress || null,
            source: session.adminReview?.editedSource || 'Akinator',
            overallStatus: CustomerStatus.LEAD_MOI,
            priority:
              session.adminReview?.editedPriority ||
              (session.result?.outcomeData as any)?.primaryPriority ||
              PriorityLevel.CHUA_CO_NHU_CAU,
            note:
              session.adminReview?.processorNote ||
              session.result?.summaryDescription ||
              'Chuyển từ lượt khảo sát Akinator đã duyệt',
          },
        });

        // Link customer to admin review
        await tx.akinatorAdminReview.upsert({
          where: { sessionId: session.id },
          create: {
            sessionId: session.id,
            linkedCustomerId: createdCustomer.id,
          },
          update: {
            linkedCustomerId: createdCustomer.id,
          },
        });

        // Update session status to TRANSFERRED
        await tx.akinatorSession.update({
          where: { id: session.id },
          data: {
            workflowStatus: AkinatorWorkflowStatus.TRANSFERRED,
          },
        });

        // Record status history
        await tx.akinatorStatusHistory.create({
          data: {
            sessionId: session.id,
            fromStatus: AkinatorWorkflowStatus.APPROVED,
            toStatus: AkinatorWorkflowStatus.TRANSFERRED,
            actionType: 'TRANSFER_CREATE_NEW_CUSTOMER',
            note: `Tạo mới khách hàng CRM từ hồ sơ Akinator đã duyệt: ${createdCustomer.fullName} (${createdCustomer.phone}) - ID: ${createdCustomer.id}.`,
            actorUserId: actor.userId || null,
            actorEmail: actor.email || null,
          },
        });

        // Log audit trail
        await auditLogService.log({
          actorId: actor.userId || undefined,
          actorEmail: actor.email || undefined,
          action: 'TRANSFER_AKINATOR_TO_NEW_CUSTOMER',
          entityType: 'CUSTOMER',
          entityId: createdCustomer.id,
          details: {
            sessionId: session.id,
            mode: 'CREATE_NEW',
            customerId: createdCustomer.id,
            customerPhone: createdCustomer.phone,
          },
        });

        return {
          alreadyTransferred: false,
          sessionId: session.id,
          customerId: createdCustomer.id,
          customer: {
            id: createdCustomer.id,
            fullName: createdCustomer.fullName,
            phone: createdCustomer.phone,
            email: createdCustomer.email,
            overallStatus: createdCustomer.overallStatus,
          },
          mode: 'CREATE_NEW',
          message: `Đã tạo mới khách hàng CRM thành công: ${createdCustomer.fullName}`,
        };
      }

      throw new BadRequestError('Phương thức chuyển không hợp lệ');
        });
      } catch (err: any) {
        const isConflict =
          err?.code === 'P2034' ||
          err?.meta?.code === 1020 ||
          err?.meta?.code === 1213 ||
          String(err?.message || '').includes('Record has changed since last read') ||
          String(err?.message || '').includes('try restarting transaction') ||
          String(err?.message || '').includes('Deadlock');

        if (isConflict && attempts < 3) {
          await new Promise((res) => setTimeout(res, 50 * attempts));
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestError('Không thể hoàn tất giao dịch chuyển hồ sơ');
  },
};
