/**
 * publicSurvey.service.ts
 * Business logic for creating, validating, revoking and completing
 * public survey links. Token (raw) is generated here and NEVER stored.
 * Only SHA-256 hash is persisted in the database.
 */
import crypto from 'crypto';
import prisma from '../config/database.js';
import { customerAccessService } from './customerAccess.service.js';
import { questionnaireRepository } from '../repositories/questionnaire.repository.js';
import { assessmentRepository } from '../repositories/assessment.repository.js';
import {
  validateAssessmentAnswers,
  QuestionEvalContext,
} from '../validations/assessment.validation.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from '../utils/errors.js';
import {
  AssessmentStatus,
  PublicSurveyLinkStatus,
  QuestionnaireVersionStatus,
  Role,
  ActivityType,
} from '@prisma/client';

// Default expiry: 7 days
const SURVEY_LINK_EXPIRY_DAYS = parseInt(process.env.SURVEY_LINK_EXPIRY_DAYS || '7', 10);

export interface UserContext {
  id: string;
  role: Role;
  email?: string;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateSecureToken(): string {
  // 32 bytes = 256 bits of entropy, URL-safe base64
  return crypto.randomBytes(32).toString('base64url');
}

function computeExpiry(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SURVEY_LINK_EXPIRY_DAYS);
  return d;
}

/**
 * Derives the effective status of a link based on DB fields.
 * This avoids stale enum values when clock-based expiry has passed.
 */
export function effectiveLinkStatus(link: {
  status: PublicSurveyLinkStatus;
  expiresAt: Date;
  revokedAt: Date | null;
}): PublicSurveyLinkStatus {
  if (link.status === PublicSurveyLinkStatus.REVOKED) return PublicSurveyLinkStatus.REVOKED;
  if (link.status === PublicSurveyLinkStatus.COMPLETED) return PublicSurveyLinkStatus.COMPLETED;
  if (link.expiresAt < new Date()) return PublicSurveyLinkStatus.EXPIRED;
  return PublicSurveyLinkStatus.ACTIVE;
}

// ---------------------------------------------------------------------------
// Staff-facing operations (require auth + RBAC)
// ---------------------------------------------------------------------------

export const publicSurveyService = {
  /**
   * Create a new public survey link for an existing assessment.
   * If the assessment already has an active/pending link, returns 409.
   * Staff must have access to the customer.
   */
  async createLink(
    customerId: string,
    input: { questionnaireId?: string; questionnaireVersionId?: string; notes?: string | null },
    user: UserContext
  ) {
    // 1. Assert customer write access
    await customerAccessService.assertCustomerWriteAccess(user, customerId);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, fullName: true },
    });
    if (!customer) {
      throw new NotFoundError('Khách hàng không tồn tại');
    }

    // 2. Resolve questionnaire version
    let versionId = input.questionnaireVersionId;
    if (versionId) {
      const version = await questionnaireRepository.findVersionById(versionId);
      if (!version || version.status !== QuestionnaireVersionStatus.PUBLISHED) {
        throw new BadRequestError('Phiên bản câu hỏi không hợp lệ hoặc chưa được xuất bản');
      }
      if (version.questionnaire && !version.questionnaire.active) {
        throw new BadRequestError('Bộ câu hỏi này đã ngừng sử dụng (Đã lưu trữ), không thể tạo link khảo sát mới');
      }
    } else if (input.questionnaireId) {
      const questionnaire = await questionnaireRepository.findById(input.questionnaireId);
      if (!questionnaire) {
        throw new NotFoundError('Bộ câu hỏi không tồn tại');
      }
      if (!questionnaire.active) {
        throw new BadRequestError('Bộ câu hỏi này đã ngừng sử dụng (Đã lưu trữ), không thể tạo link khảo sát mới');
      }
      const currentPub = await questionnaireRepository.findCurrentPublishedVersion(input.questionnaireId);
      if (!currentPub) {
        throw new BadRequestError('Bộ câu hỏi này chưa có phiên bản nào được xuất bản');
      }
      versionId = currentPub.id;
    } else {
      throw new BadRequestError('Cần cung cấp questionnaireId hoặc questionnaireVersionId');
    }

    // 3. Create assessment + link atomically
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = computeExpiry();

    const result = await prisma.$transaction(async (tx) => {
      // Create IN_PROGRESS assessment
      const assessment = await tx.assessment.create({
        data: {
          customerId,
          questionnaireVersionId: versionId!,
          performedById: user.id,
          notes: input.notes ?? null,
          status: AssessmentStatus.IN_PROGRESS,
        },
      });

      // Create public survey link
      const link = await tx.publicSurveyLink.create({
        data: {
          tokenHash,
          assessmentId: assessment.id,
          createdById: user.id,
          status: PublicSurveyLinkStatus.ACTIVE,
          expiresAt,
        },
        include: {
          assessment: {
            include: {
              questionnaireVersion: {
                include: {
                  questionnaire: { select: { id: true, code: true, title: true } },
                },
              },
            },
          },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      return { assessment, link };
    });

    // Return token ONLY at creation time — never stored raw
    return {
      linkId: result.link.id,
      rawToken,
      assessmentId: result.assessment.id,
      expiresAt,
      status: PublicSurveyLinkStatus.ACTIVE,
      questionnaire: result.link.assessment.questionnaireVersion.questionnaire,
      versionId: result.link.assessment.questionnaireVersionId,
      createdBy: result.link.createdBy,
      createdAt: result.link.createdAt,
    };
  },

  /**
   * List all public survey links for a customer (no raw tokens returned).
   */
  async listLinksByCustomer(customerId: string, user: UserContext) {
    await customerAccessService.assertCustomerAccess(user, customerId);
    const links = await prisma.publicSurveyLink.findMany({
      where: {
        assessment: { customerId },
      },
      include: {
        assessment: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            questionnaireVersion: {
              select: {
                id: true,
                versionNumber: true,
                title: true,
                questionnaire: { select: { id: true, code: true, title: true } },
              },
            },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
        revokedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((l) => ({
      id: l.id,
      assessmentId: l.assessmentId,
      status: effectiveLinkStatus(l),
      expiresAt: l.expiresAt,
      revokedAt: l.revokedAt,
      completedAt: l.completedAt,
      lastAccessedAt: l.lastAccessedAt,
      createdAt: l.createdAt,
      assessment: l.assessment,
      createdBy: l.createdBy,
      revokedBy: l.revokedBy,
    }));
  },

  /**
   * Get link details by ID (staff, authenticated).
   */
  async getLinkById(linkId: string, user: UserContext) {
    const link = await prisma.publicSurveyLink.findUnique({
      where: { id: linkId },
      include: {
        assessment: {
          select: {
            id: true,
            customerId: true,
            status: true,
            completedAt: true,
            questionnaireVersion: {
              select: {
                id: true,
                versionNumber: true,
                title: true,
                questionnaire: { select: { id: true, code: true, title: true } },
              },
            },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
        revokedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!link) throw new NotFoundError('Link khảo sát không tồn tại');

    await customerAccessService.assertCustomerAccess(user, link.assessment.customerId);

    return {
      id: link.id,
      assessmentId: link.assessmentId,
      status: effectiveLinkStatus(link),
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
      completedAt: link.completedAt,
      lastAccessedAt: link.lastAccessedAt,
      createdAt: link.createdAt,
      assessment: link.assessment,
      createdBy: link.createdBy,
      revokedBy: link.revokedBy,
    };
  },

  /**
   * Revoke a public survey link (does NOT delete assessment or answers).
   */
  async revokeLink(linkId: string, user: UserContext) {
    const link = await prisma.publicSurveyLink.findUnique({
      where: { id: linkId },
      include: { assessment: { select: { customerId: true } } },
    });
    if (!link) throw new NotFoundError('Link khảo sát không tồn tại');

    await customerAccessService.assertCustomerWriteAccess(user, link.assessment.customerId);

    const eff = effectiveLinkStatus(link);
    if (eff === PublicSurveyLinkStatus.REVOKED) {
      throw new BadRequestError('Link này đã bị thu hồi trước đó');
    }
    if (eff === PublicSurveyLinkStatus.COMPLETED) {
      throw new BadRequestError('Không thể thu hồi link của khảo sát đã hoàn thành');
    }

    return prisma.publicSurveyLink.update({
      where: { id: linkId },
      data: {
        status: PublicSurveyLinkStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: user.id,
      },
    });
  },

  // ---------------------------------------------------------------------------
  // Public (unauthenticated) operations — token-only auth
  // ---------------------------------------------------------------------------

  /**
   * Validate token and return minimal public info (no customer PII).
   */
  async getPublicSurveyInfo(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    const link = await prisma.publicSurveyLink.findUnique({
      where: { tokenHash },
      include: {
        assessment: {
          include: {
            answers: {
              select: { questionCode: true, answerValue: true, questionId: true },
            },
            questionnaireVersion: {
              include: {
                questions: {
                  where: { active: true },
                  orderBy: { displayOrder: 'asc' },
                },
                questionnaire: { select: { title: true, description: true } },
              },
            },
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundError('Link khảo sát không hợp lệ');
    }

    // Update last accessed (non-blocking, best-effort)
    prisma.publicSurveyLink
      .update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } })
      .catch(() => {});

    const eff = effectiveLinkStatus(link);
    return { link, effectiveStatus: eff };
  },

  /**
   * Validate token and assert it is usable for writing.
   */
  async assertWritable(rawToken: string) {
    const { link, effectiveStatus } = await this.getPublicSurveyInfo(rawToken);

    if (effectiveStatus === PublicSurveyLinkStatus.EXPIRED) {
      throw new ForbiddenError('Link khảo sát đã hết hạn. Vui lòng liên hệ nhân viên để cấp link mới.');
    }
    if (effectiveStatus === PublicSurveyLinkStatus.REVOKED) {
      throw new ForbiddenError('Link khảo sát đã bị thu hồi.');
    }
    if (effectiveStatus === PublicSurveyLinkStatus.COMPLETED) {
      throw new ForbiddenError('Bạn đã hoàn thành khảo sát này. Không thể chỉnh sửa thêm.');
    }
    if (link.assessment.status !== AssessmentStatus.IN_PROGRESS) {
      throw new ForbiddenError('Khảo sát này không còn có thể chỉnh sửa.');
    }
    return link;
  },

  /**
   * Public: save draft answers (partial, idempotent).
   */
  async publicSaveAnswers(
    rawToken: string,
    answers: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>
  ) {
    const link = await this.assertWritable(rawToken);
    const assessment = link.assessment;

    const questions: QuestionEvalContext[] = assessment.questionnaireVersion.questions.map((q) => ({
      id: q.id,
      code: q.code,
      questionText: q.questionText,
      questionType: q.questionType,
      isRequired: q.isRequired,
      displayOrder: q.displayOrder,
      options: q.options as any,
      validationConfig: q.validationConfig as any,
      conditionalLogic: q.conditionalLogic as any,
      active: q.active,
    }));

    const validationResult = validateAssessmentAnswers(questions, answers, 'DRAFT');
    if (!validationResult.isValid) {
      throw new BadRequestError(
        `Lỗi xác thực câu trả lời: ${validationResult.errors.join('; ')}`
      );
    }

    await assessmentRepository.saveAnswers(assessment.id, validationResult.cleanAnswers, null);
    return { saved: validationResult.cleanAnswers.length };
  },

  /**
   * Public: complete survey — runs strict validation, marks completed atomically.
   */
  async publicCompleteAssessment(
    rawToken: string,
    finalAnswers?: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>
  ) {
    const link = await this.assertWritable(rawToken);
    const assessment = link.assessment;

    // Merge existing saved answers with newly submitted ones
    const answerMap = new Map<string, { questionCode: string; questionId?: string | null; answerValue: any }>();
    for (const a of assessment.answers || []) {
      answerMap.set(a.questionCode, {
        questionCode: a.questionCode,
        questionId: (a as any).questionId ?? null,
        answerValue: a.answerValue,
      });
    }
    if (finalAnswers && finalAnswers.length > 0) {
      for (const fa of finalAnswers) {
        answerMap.set(fa.questionCode, fa);
      }
    }

    const allAnswers = Array.from(answerMap.values());
    const questions: QuestionEvalContext[] = assessment.questionnaireVersion.questions.map((q) => ({
      id: q.id,
      code: q.code,
      questionText: q.questionText,
      questionType: q.questionType,
      isRequired: q.isRequired,
      displayOrder: q.displayOrder,
      options: q.options as any,
      validationConfig: q.validationConfig as any,
      conditionalLogic: q.conditionalLogic as any,
      active: q.active,
    }));

    const validationResult = validateAssessmentAnswers(questions, allAnswers, 'COMPLETE');
    if (!validationResult.isValid) {
      throw new BadRequestError(
        `Còn thiếu hoặc sai thông tin: ${validationResult.errors.join('; ')}`
      );
    }

    const now = new Date();

    await prisma.$transaction(
      async (tx) => {
        // Save final cleaned answers concurrently
        await Promise.all(
          validationResult.cleanAnswers.map((ans) =>
            tx.assessmentAnswer.upsert({
              where: {
                assessment_question_unique: {
                  assessmentId: assessment.id,
                  questionCode: ans.questionCode,
                },
              },
              create: {
                assessmentId: assessment.id,
                questionCode: ans.questionCode,
                questionId: ans.questionId ?? null,
                answerValue: ans.answerValue,
              },
              update: {
                answerValue: ans.answerValue,
                questionId: ans.questionId ?? null,
              },
            })
          )
        );

        // Mark assessment completed
        await tx.assessment.update({
          where: { id: assessment.id },
          data: { status: AssessmentStatus.COMPLETED, completedAt: now },
        });

        // Mark link completed
        await tx.publicSurveyLink.update({
          where: { id: link.id },
          data: { status: PublicSurveyLinkStatus.COMPLETED, completedAt: now },
        });

        // Log activity to customer timeline
        const qTitle =
          assessment.questionnaireVersion?.questionnaire?.title || 'Khảo sát nhu cầu';
        await tx.customerActivity.create({
          data: {
            customerId: assessment.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Khách hàng hoàn tất khảo sát trực tuyến',
            description: `Khách hàng đã tự hoàn thành bộ khảo sát "${qTitle}" qua link tự phục vụ.`,
            occurredAt: now,
          },
        });
      },
      { timeout: 30000, maxWait: 10000 }
    );

    return { completed: true, completedAt: now };
  },
};
