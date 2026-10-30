import prisma from '../config/database.js';
import {
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorSessionSourceType,
  AkinatorQuizStatus,
  AkinatorWorkflowStatus,
  AkinatorEvaluationStatus,
  Prisma,
} from '@prisma/client';
import { DEFAULT_AKINATOR_DISCLAIMER } from '../services/akinatorEngine.service.js';

export interface CreateAkinatorDraftInput {
  title: string;
  description?: string | null;
  maxQuestionsPerSession?: number;
  disclaimerText?: string;
  changeLog?: string | null;
  createdById?: string | null;
  sourceVersionId?: string;
}

export interface SaveAkinatorQuestionInput {
  code: string;
  questionText: string;
  description?: string | null;
  questionType: AkinatorQuestionType;
  isEntryQuestion?: boolean;
  isRequiredForEval?: boolean;
  priorityWeight?: number;
  mapsToCustomerField?: AkinatorCustomerFieldMapping;
  options?: any;
  validationConfig?: any;
  visibilityConditions?: any;
  nextQuestionRules?: any;
  active?: boolean;
}

export interface SaveAkinatorRuleInput {
  code: string;
  name: string;
  description?: string | null;
  priorityOrder?: number;
  requiredQuestionCodes?: string[];
  conditions: any;
  outcomePayload: any;
  stopOnMatch?: boolean;
  active?: boolean;
}

export const akinatorRepository = {
  // =========================================================================
  // 1. CONFIGURATION & VERSIONING
  // =========================================================================

  async listConfigVersions(status?: AkinatorConfigStatus) {
    return prisma.akinatorConfigVersion.findMany({
      where: status ? { status } : undefined,
      include: {
        _count: {
          select: {
            questions: true,
            rules: true,
            sessions: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  },

  async findConfigVersionById(versionId: string) {
    return prisma.akinatorConfigVersion.findUnique({
      where: { id: versionId },
      include: {
        questions: {
          orderBy: [
            { isEntryQuestion: 'desc' },
            { priorityWeight: 'desc' },
            { code: 'asc' },
          ],
        },
        rules: {
          orderBy: { priorityOrder: 'asc' },
        },
        _count: {
          select: {
            sessions: true,
          },
        },
      },
    });
  },

  async findCurrentPublishedConfig() {
    return prisma.akinatorConfigVersion.findFirst({
      where: {
        status: AkinatorConfigStatus.PUBLISHED,
        isCurrent: true,
      },
      include: {
        questions: {
          where: { active: true },
          orderBy: [
            { isEntryQuestion: 'desc' },
            { priorityWeight: 'desc' },
            { code: 'asc' },
          ],
        },
        rules: {
          where: { active: true },
          orderBy: { priorityOrder: 'asc' },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  },

  async findOpenDraftConfig() {
    return prisma.akinatorConfigVersion.findFirst({
      where: { status: AkinatorConfigStatus.DRAFT },
      include: {
        questions: {
          orderBy: [
            { isEntryQuestion: 'desc' },
            { priorityWeight: 'desc' },
            { code: 'asc' },
          ],
        },
        rules: {
          orderBy: { priorityOrder: 'asc' },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  },

  async createDraftConfig(input: CreateAkinatorDraftInput) {
    return prisma.$transaction(async (tx) => {
      const latest = await tx.akinatorConfigVersion.findFirst({
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });
      const nextVersionNumber = (latest?.versionNumber || 0) + 1;

      let sourceConfig = null;
      if (input.sourceVersionId) {
        sourceConfig = await tx.akinatorConfigVersion.findUnique({
          where: { id: input.sourceVersionId },
          include: { questions: true, rules: true },
        });
      }

      const created = await tx.akinatorConfigVersion.create({
        data: {
          versionNumber: nextVersionNumber,
          title: input.title,
          description: input.description ?? sourceConfig?.description ?? null,
          status: AkinatorConfigStatus.DRAFT,
          isCurrent: false,
          maxQuestionsPerSession:
            input.maxQuestionsPerSession ?? sourceConfig?.maxQuestionsPerSession ?? 15,
          disclaimerText:
            input.disclaimerText ?? sourceConfig?.disclaimerText ?? DEFAULT_AKINATOR_DISCLAIMER,
          changeLog: input.changeLog ?? null,
          createdById: input.createdById ?? null,
        },
      });

      if (sourceConfig) {
        if (sourceConfig.questions.length > 0) {
          await tx.akinatorQuestion.createMany({
            data: sourceConfig.questions.map((q) => ({
              configVersionId: created.id,
              code: q.code,
              questionText: q.questionText,
              description: q.description,
              questionType: q.questionType,
              isEntryQuestion: q.isEntryQuestion,
              isRequiredForEval: q.isRequiredForEval,
              priorityWeight: q.priorityWeight,
              mapsToCustomerField: q.mapsToCustomerField,
              options: q.options ?? Prisma.JsonNull,
              validationConfig: q.validationConfig ?? Prisma.JsonNull,
              visibilityConditions: q.visibilityConditions ?? Prisma.JsonNull,
              nextQuestionRules: q.nextQuestionRules ?? Prisma.JsonNull,
              active: q.active,
            })),
          });
        }

        if (sourceConfig.rules.length > 0) {
          await tx.akinatorRule.createMany({
            data: sourceConfig.rules.map((r) => ({
              configVersionId: created.id,
              code: r.code,
              name: r.name,
              description: r.description,
              priorityOrder: r.priorityOrder,
              requiredQuestionCodes: r.requiredQuestionCodes as any,
              conditions: r.conditions as any,
              outcomePayload: r.outcomePayload as any,
              stopOnMatch: r.stopOnMatch,
              active: r.active,
            })),
          });
        }
      }

      return tx.akinatorConfigVersion.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          questions: {
            orderBy: [
              { isEntryQuestion: 'desc' },
              { priorityWeight: 'desc' },
              { code: 'asc' },
            ],
          },
          rules: {
            orderBy: { priorityOrder: 'asc' },
          },
        },
      });
    });
  },

  async updateDraftMetadata(
    versionId: string,
    data: {
      title?: string;
      description?: string | null;
      maxQuestionsPerSession?: number;
      disclaimerText?: string;
      changeLog?: string | null;
    }
  ) {
    return prisma.akinatorConfigVersion.update({
      where: { id: versionId },
      data,
      include: {
        questions: {
          orderBy: [
            { isEntryQuestion: 'desc' },
            { priorityWeight: 'desc' },
            { code: 'asc' },
          ],
        },
        rules: {
          orderBy: { priorityOrder: 'asc' },
        },
      },
    });
  },

  async saveDraftQuestions(versionId: string, questions: SaveAkinatorQuestionInput[]) {
    return prisma.$transaction(async (tx) => {
      await tx.akinatorQuestion.deleteMany({
        where: { configVersionId: versionId },
      });

      await tx.akinatorQuestion.createMany({
        data: questions.map((q) => ({
          configVersionId: versionId,
          code: q.code,
          questionText: q.questionText,
          description: q.description ?? null,
          questionType: q.questionType,
          isEntryQuestion: Boolean(q.isEntryQuestion),
          isRequiredForEval: Boolean(q.isRequiredForEval),
          priorityWeight: q.priorityWeight ?? 50,
          mapsToCustomerField: q.mapsToCustomerField ?? AkinatorCustomerFieldMapping.NONE,
          options: q.options ?? Prisma.JsonNull,
          validationConfig: q.validationConfig ?? Prisma.JsonNull,
          visibilityConditions: q.visibilityConditions ?? Prisma.JsonNull,
          nextQuestionRules: q.nextQuestionRules ?? Prisma.JsonNull,
          active: q.active !== undefined ? Boolean(q.active) : true,
        })),
      });

      return tx.akinatorConfigVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: {
          questions: {
            orderBy: [
              { isEntryQuestion: 'desc' },
              { priorityWeight: 'desc' },
              { code: 'asc' },
            ],
          },
          rules: {
            orderBy: { priorityOrder: 'asc' },
          },
        },
      });
    });
  },

  async saveDraftRules(versionId: string, rules: SaveAkinatorRuleInput[]) {
    return prisma.$transaction(async (tx) => {
      await tx.akinatorRule.deleteMany({
        where: { configVersionId: versionId },
      });

      await tx.akinatorRule.createMany({
        data: rules.map((r, idx) => ({
          configVersionId: versionId,
          code: r.code,
          name: r.name,
          description: r.description ?? null,
          priorityOrder: r.priorityOrder ?? idx + 1,
          requiredQuestionCodes: r.requiredQuestionCodes ?? [],
          conditions: r.conditions,
          outcomePayload: r.outcomePayload,
          stopOnMatch: Boolean(r.stopOnMatch),
          active: r.active !== undefined ? Boolean(r.active) : true,
        })),
      });

      return tx.akinatorConfigVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: {
          questions: {
            orderBy: [
              { isEntryQuestion: 'desc' },
              { priorityWeight: 'desc' },
              { code: 'asc' },
            ],
          },
          rules: {
            orderBy: { priorityOrder: 'asc' },
          },
        },
      });
    });
  },

  async publishConfigVersion(
    versionId: string,
    publishedById?: string | null,
    changeLog?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // Demote previously current published version(s) to ARCHIVED & isCurrent=false
      await tx.akinatorConfigVersion.updateMany({
        where: {
          isCurrent: true,
          id: { not: versionId },
        },
        data: {
          isCurrent: false,
          status: AkinatorConfigStatus.ARCHIVED,
        },
      });

      return tx.akinatorConfigVersion.update({
        where: { id: versionId },
        data: {
          status: AkinatorConfigStatus.PUBLISHED,
          isCurrent: true,
          publishedAt: new Date(),
          publishedById: publishedById ?? null,
          ...(changeLog !== undefined ? { changeLog } : {}),
        },
        include: {
          questions: {
            orderBy: [
              { isEntryQuestion: 'desc' },
              { priorityWeight: 'desc' },
              { code: 'asc' },
            ],
          },
          rules: {
            orderBy: { priorityOrder: 'asc' },
          },
        },
      });
    });
  },

  // =========================================================================
  // 2. QUIZ SESSIONS & RAW ANSWERS
  // =========================================================================

  async createSession(data: { sessionTokenHash: string; configVersionId: string }) {
    return prisma.akinatorSession.create({
      data: {
        sessionTokenHash: data.sessionTokenHash,
        configVersionId: data.configVersionId,
        quizStatus: AkinatorQuizStatus.IN_PROGRESS,
      },
    });
  },

  async findSessionByTokenHash(sessionTokenHash: string) {
    return prisma.akinatorSession.findUnique({
      where: { sessionTokenHash },
      include: {
        configVersion: {
          include: {
            questions: {
              orderBy: [
                { isEntryQuestion: 'desc' },
                { priorityWeight: 'desc' },
                { code: 'asc' },
              ],
            },
            rules: {
              orderBy: { priorityOrder: 'asc' },
            },
          },
        },
        rawAnswers: {
          orderBy: { stepOrder: 'asc' },
        },
        result: true,
      },
    });
  },

  // =========================================================================
  // 3. ADMIN REVIEW & WORKFLOW QUERIES
  // =========================================================================

  async findSessionDetailById(id: string) {
    return prisma.akinatorSession.findUnique({
      where: { id },
      include: {
        configVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
            status: true,
            publishedAt: true,
          },
        },
        rawAnswers: {
          orderBy: { stepOrder: 'asc' },
        },
        result: true,
        adminReview: true,
        statusHistories: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },

  async findSessionsForAdmin(filters: {
    page: number;
    pageSize: number;
    quizStatus?: AkinatorQuizStatus;
    workflowStatus?: AkinatorWorkflowStatus;
    evaluationStatus?: AkinatorEvaluationStatus;
    search?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: Prisma.AkinatorSessionWhereInput = {};

    if (filters.quizStatus) {
      where.quizStatus = filters.quizStatus;
    }
    if (filters.workflowStatus) {
      where.workflowStatus = filters.workflowStatus;
    }
    if (filters.evaluationStatus) {
      where.result = {
        evaluationStatus: filters.evaluationStatus,
      };
    }

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {
        ...(filters.fromDate ? { gte: filters.fromDate } : {}),
        ...(filters.toDate ? { lte: filters.toDate } : {}),
      };
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { rawFullName: { contains: q } },
        { rawPhone: { contains: q } },
        { rawEmail: { contains: q } },
        { adminReview: { editedFullName: { contains: q } } },
        { adminReview: { editedPhone: { contains: q } } },
        { adminReview: { editedEmail: { contains: q } } },
      ];
    }

    const skip = (filters.page - 1) * filters.pageSize;

    const [total, items] = await Promise.all([
      prisma.akinatorSession.count({ where }),
      prisma.akinatorSession.findMany({
        where,
        include: {
          configVersion: {
            select: {
              id: true,
              versionNumber: true,
              title: true,
            },
          },
          result: {
            select: {
              id: true,
              evaluationStatus: true,
              summaryTitle: true,
              generatedAt: true,
            },
          },
          adminReview: true,
          _count: {
            select: {
              rawAnswers: true,
            },
          },
        },
        orderBy: [
          { completedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take: filters.pageSize,
      }),
    ]);

    return { total, items };
  },

  // =========================================================================
  // 4. CUSTOMER AKINATOR SESSIONS & MULTI-SESSION HISTORY
  // =========================================================================

  async createCustomerSession(data: {
    sessionTokenHash: string;
    configVersionId: string;
    customerId: string;
    createdById?: string | null;
    expiresAt?: Date | null;
  }) {
    return prisma.akinatorSession.create({
      data: {
        sessionTokenHash: data.sessionTokenHash,
        configVersionId: data.configVersionId,
        sourceType: AkinatorSessionSourceType.CRM_CUSTOMER_LINK,
        customerId: data.customerId,
        createdById: data.createdById ?? null,
        quizStatus: AkinatorQuizStatus.NOT_STARTED,
        expiresAt: data.expiresAt ?? null,
      },
      include: {
        configVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  },

  async findSessionsByCustomerId(customerId: string) {
    return prisma.akinatorSession.findMany({
      where: { customerId },
      include: {
        configVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        result: true,
        _count: {
          select: {
            rawAnswers: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });
  },

  async findLatestCompletedResultByCustomerId(customerId: string) {
    return prisma.akinatorSession.findFirst({
      where: {
        customerId,
        quizStatus: AkinatorQuizStatus.COMPLETED,
        result: { isNot: null },
      },
      include: {
        configVersion: {
          select: {
            id: true,
            versionNumber: true,
            title: true,
            disclaimerText: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        result: true,
        rawAnswers: {
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: [
        { completedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  },

  async findSessionById(id: string) {
    return prisma.akinatorSession.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });
  },

  async revokeSession(sessionId: string, revokedById?: string | null) {
    return prisma.akinatorSession.update({
      where: { id: sessionId },
      data: {
        quizStatus: AkinatorQuizStatus.REVOKED,
        revokedAt: new Date(),
        revokedById: revokedById ?? null,
      },
    });
  },
};
