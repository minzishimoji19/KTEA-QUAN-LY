import prisma from '../config/database.js';
import { RuleVersionStatus, RecommendationRunStatus, Prisma } from '@prisma/client';
import { EvaluatedRecommendationItem } from '../validations/assessmentRecommendation.validation.js';

export const assessmentRecommendationRepository = {
  // =========================================================================
  // RULE SET & VERSION MANAGEMENT
  // =========================================================================

  async findAllRuleSets() {
    return prisma.assessmentRecommendationRuleSet.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            isCurrent: true,
            publishedAt: true,
            publishedBy: true,
            createdBy: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  },

  async findRuleSetById(id: string) {
    return prisma.assessmentRecommendationRuleSet.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async findRuleSetByCode(code: string) {
    return prisma.assessmentRecommendationRuleSet.findUnique({
      where: { code },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async findRuleVersionById(id: string) {
    return prisma.assessmentRecommendationRuleVersion.findUnique({
      where: { id },
      include: {
        ruleSet: true,
      },
    });
  },

  async findCurrentPublishedRuleVersion(ruleSetCode?: string) {
    if (ruleSetCode) {
      return prisma.assessmentRecommendationRuleVersion.findFirst({
        where: {
          status: RuleVersionStatus.PUBLISHED,
          isCurrent: true,
          ruleSet: { code: ruleSetCode },
        },
        include: { ruleSet: true },
        orderBy: { versionNumber: 'desc' },
      });
    }

    return prisma.assessmentRecommendationRuleVersion.findFirst({
      where: {
        status: RuleVersionStatus.PUBLISHED,
        isCurrent: true,
      },
      include: { ruleSet: true },
      orderBy: { versionNumber: 'desc' },
    });
  },

  async createRuleSet(data: { code: string; title: string; description?: string | null }) {
    return prisma.assessmentRecommendationRuleSet.create({
      data: {
        code: data.code,
        title: data.title,
        description: data.description,
      },
    });
  },

  async createRuleVersion(data: {
    ruleSetId: string;
    rules: Prisma.InputJsonValue;
    changeLog?: string | null;
    createdBy?: string | null;
  }) {
    const latest = await prisma.assessmentRecommendationRuleVersion.findFirst({
      where: { ruleSetId: data.ruleSetId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const nextVersion = (latest?.versionNumber || 0) + 1;

    return prisma.assessmentRecommendationRuleVersion.create({
      data: {
        ruleSetId: data.ruleSetId,
        versionNumber: nextVersion,
        status: RuleVersionStatus.DRAFT,
        isCurrent: false,
        rules: data.rules,
        changeLog: data.changeLog,
        createdBy: data.createdBy,
      },
      include: { ruleSet: true },
    });
  },

  async updateRuleVersion(
    versionId: string,
    data: { rules: Prisma.InputJsonValue; changeLog?: string | null }
  ) {
    return prisma.assessmentRecommendationRuleVersion.update({
      where: { id: versionId },
      data: {
        rules: data.rules,
        ...(data.changeLog !== undefined ? { changeLog: data.changeLog } : {}),
      },
      include: { ruleSet: true },
    });
  },

  async publishRuleVersion(versionId: string, publishedBy?: string | null) {
    return prisma.$transaction(async (tx) => {
      const version = await tx.assessmentRecommendationRuleVersion.findUnique({
        where: { id: versionId },
      });
      if (!version) return null;

      // Unset previous published current versions of the same rule set
      await tx.assessmentRecommendationRuleVersion.updateMany({
        where: { ruleSetId: version.ruleSetId, isCurrent: true },
        data: { isCurrent: false },
      });

      // Mark this version as published and current
      return tx.assessmentRecommendationRuleVersion.update({
        where: { id: versionId },
        data: {
          status: RuleVersionStatus.PUBLISHED,
          isCurrent: true,
          publishedAt: new Date(),
          publishedBy,
        },
        include: { ruleSet: true },
      });
    });
  },

  // =========================================================================
  // RECOMMENDATION RUN EXECUTION & HISTORY
  // =========================================================================

  async findRunsByCustomerId(customerId: string) {
    return prisma.assessmentRecommendationRun.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        assessment: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            questionnaireVersion: {
              select: {
                versionNumber: true,
                questionnaire: { select: { title: true, code: true } },
              },
            },
          },
        },
        ruleVersion: {
          select: {
            versionNumber: true,
            ruleSet: { select: { title: true, code: true } },
          },
        },
        performedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });
  },

  async findRunsByAssessmentId(assessmentId: string) {
    return prisma.assessmentRecommendationRun.findMany({
      where: { assessmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        ruleVersion: {
          select: {
            versionNumber: true,
            ruleSet: { select: { title: true, code: true } },
          },
        },
        performedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        _count: {
          select: { items: true },
        },
      },
    });
  },

  async findRunById(runId: string) {
    return prisma.assessmentRecommendationRun.findUnique({
      where: { id: runId },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true, email: true },
        },
        assessment: {
          include: {
            questionnaireVersion: {
              include: {
                questionnaire: true,
                questions: { orderBy: { displayOrder: 'asc' } },
              },
            },
          },
        },
        ruleVersion: {
          include: { ruleSet: true },
        },
        performedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        items: {
          orderBy: [{ rank: 'asc' }, { score: 'desc' }],
          include: {
            product: {
              select: { id: true, code: true, name: true, active: true },
            },
          },
        },
      },
    });
  },

  async createRecommendationRun(data: {
    customerId: string;
    assessmentId: string;
    ruleVersionId: string;
    performedById?: string | null;
    status: RecommendationRunStatus;
    answersSnapshot: Prisma.InputJsonValue;
    rulesSnapshot: Prisma.InputJsonValue;
    totalCandidatesEvaluated: number;
    totalRecommended: number;
    executionTimeMs?: number | null;
    notes?: string | null;
    items: EvaluatedRecommendationItem[];
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Create run header
      const run = await tx.assessmentRecommendationRun.create({
        data: {
          customerId: data.customerId,
          assessmentId: data.assessmentId,
          ruleVersionId: data.ruleVersionId,
          performedById: data.performedById,
          status: data.status,
          answersSnapshot: data.answersSnapshot,
          rulesSnapshot: data.rulesSnapshot,
          totalCandidatesEvaluated: data.totalCandidatesEvaluated,
          totalRecommended: data.totalRecommended,
          executionTimeMs: data.executionTimeMs,
          notes: data.notes,
        },
      });

      // 2. Create items
      for (const item of data.items) {
        await tx.assessmentRecommendationItem.create({
          data: {
            runId: run.id,
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            productCategory: item.productCategory,
            productSnapshot: item.productSnapshot as Prisma.InputJsonValue,
            score: new Prisma.Decimal(item.score),
            rank: item.rank,
            confidence: item.confidence,
            isEligible: item.isEligible,
            matchSummary: item.matchSummary,
            passedCriteria: item.passedCriteria as Prisma.InputJsonValue,
            failedCriteria: item.failedCriteria as Prisma.InputJsonValue,
            unassessedCriteria: item.unassessedCriteria as Prisma.InputJsonValue,
            warnings: item.warnings as Prisma.InputJsonValue,
            answersUsed: item.answersUsed as Prisma.InputJsonValue,
          },
        });
      }

      // Return complete run with items
      return tx.assessmentRecommendationRun.findUnique({
        where: { id: run.id },
        include: {
          items: {
            orderBy: [{ rank: 'asc' }],
          },
          ruleVersion: {
            include: { ruleSet: true },
          },
          performedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    });
  },
};
