import prisma from '../config/database.js';
import {
  Questionnaire,
  QuestionnaireVersion,
  QuestionDefinition,
  QuestionnaireVersionStatus,
  Prisma,
} from '@prisma/client';
import { QuestionDefinitionInput } from '../validations/questionnaire.validation.js';

export interface CreateQuestionnaireRepoInput {
  code: string;
  title: string;
  description?: string | null;
  active?: boolean;
  createdBy?: string;
  initialQuestions?: QuestionDefinitionInput[];
}

export interface UpdateQuestionnaireRepoInput {
  title?: string;
  description?: string | null;
  active?: boolean;
}

export interface CreateDraftVersionRepoInput {
  questionnaireId: string;
  title?: string | null;
  description?: string | null;
  changeLog?: string | null;
  createdBy?: string | null;
  sourceVersionId?: string;
}

export const questionnaireRepository = {
  async findAll(activeOnly = false) {
    return prisma.questionnaire.findMany({
      where: activeOnly ? { active: true } : undefined,
      include: {
        versions: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            isCurrent: true,
            title: true,
            publishedAt: true,
            publishedBy: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { questions: true },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.questionnaire.findUnique({
      where: { id },
      include: {
        versions: {
          include: {
            questions: {
              orderBy: { displayOrder: 'asc' },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async findByCode(code: string) {
    return prisma.questionnaire.findUnique({
      where: { code },
      include: {
        versions: {
          include: {
            questions: {
              orderBy: { displayOrder: 'asc' },
            },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async findVersionById(versionId: string) {
    return prisma.questionnaireVersion.findUnique({
      where: { id: versionId },
      include: {
        questionnaire: true,
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  },

  async findCurrentPublishedVersion(questionnaireId: string) {
    return prisma.questionnaireVersion.findFirst({
      where: {
        questionnaireId,
        isCurrent: true,
        status: QuestionnaireVersionStatus.PUBLISHED,
      },
      include: {
        questions: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
  },

  async findDraftVersion(questionnaireId: string) {
    return prisma.questionnaireVersion.findFirst({
      where: {
        questionnaireId,
        status: QuestionnaireVersionStatus.DRAFT,
      },
      include: {
        questions: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  },

  async create(data: CreateQuestionnaireRepoInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Create questionnaire
      const questionnaire = await tx.questionnaire.create({
        data: {
          code: data.code,
          title: data.title,
          description: data.description,
          active: data.active ?? true,
        },
      });

      // 2. Create initial DRAFT version 1
      const version = await tx.questionnaireVersion.create({
        data: {
          questionnaireId: questionnaire.id,
          versionNumber: 1,
          status: QuestionnaireVersionStatus.DRAFT,
          isCurrent: false,
          title: 'Phiên bản khởi tạo (Bản nháp)',
          description: data.description,
          createdBy: data.createdBy,
        },
      });

      // 3. Insert initial questions if provided
      if (data.initialQuestions && data.initialQuestions.length > 0) {
        const questionRecords = data.initialQuestions.map((q, i) => ({
          versionId: version.id,
          code: q.code,
          questionText: q.questionText,
          description: q.description || null,
          questionType: q.questionType,
          isRequired: q.isRequired ?? false,
          displayOrder: q.displayOrder ?? i + 1,
          options: q.options ? (q.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          validationConfig: q.validationConfig
            ? (q.validationConfig as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          conditionalLogic: q.conditionalLogic
            ? (q.conditionalLogic as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          active: q.active ?? true,
        }));

        await tx.questionDefinition.createMany({
          data: questionRecords,
        });
      }

      return tx.questionnaire.findUnique({
        where: { id: questionnaire.id },
        include: {
          versions: {
            include: {
              questions: {
                orderBy: { displayOrder: 'asc' },
              },
            },
          },
        },
      });
    }, {
      maxWait: 15000,
      timeout: 60000,
    });
  },

  async update(id: string, data: UpdateQuestionnaireRepoInput) {
    return prisma.questionnaire.update({
      where: { id },
      data,
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });
  },

  async delete(id: string) {
    return prisma.questionnaire.delete({
      where: { id },
    });
  },

  async createDraftVersion(data: CreateDraftVersionRepoInput) {
    return prisma.$transaction(async (tx) => {
      // Find latest version number
      const latest = await tx.questionnaireVersion.findFirst({
        where: { questionnaireId: data.questionnaireId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true, id: true },
      });

      const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

      // Create new draft version
      const newVersion = await tx.questionnaireVersion.create({
        data: {
          questionnaireId: data.questionnaireId,
          versionNumber: nextVersionNumber,
          status: QuestionnaireVersionStatus.DRAFT,
          isCurrent: false,
          title: data.title || `Bản nháp v${nextVersionNumber}`,
          description: data.description,
          changeLog: data.changeLog,
          createdBy: data.createdBy,
        },
      });

      // Clone questions from source version if requested or latest published
      const sourceId = data.sourceVersionId || latest?.id;
      if (sourceId) {
        const sourceQuestions = await tx.questionDefinition.findMany({
          where: { versionId: sourceId },
          orderBy: { displayOrder: 'asc' },
        });

        for (const sq of sourceQuestions) {
          await tx.questionDefinition.create({
            data: {
              versionId: newVersion.id,
              code: sq.code,
              questionText: sq.questionText,
              description: sq.description,
              questionType: sq.questionType,
              isRequired: sq.isRequired,
              displayOrder: sq.displayOrder,
              options: sq.options ? (sq.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              validationConfig: sq.validationConfig ? (sq.validationConfig as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              conditionalLogic: sq.conditionalLogic ? (sq.conditionalLogic as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              active: sq.active,
            },
          });
        }
      }

      return tx.questionnaireVersion.findUnique({
        where: { id: newVersion.id },
        include: {
          questionnaire: true,
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
    });
  },

  async saveDraftQuestions(versionId: string, questions: QuestionDefinitionInput[]) {
    return prisma.$transaction(
      async (tx) => {
        // Delete old questions for this draft version
        await tx.questionDefinition.deleteMany({
          where: { versionId },
        });

        // Insert new questions in ordered sequence via createMany
        if (questions.length > 0) {
          const questionRecords = questions.map((q, i) => ({
            versionId,
            code: q.code,
            questionText: q.questionText,
            description: q.description || null,
            questionType: q.questionType,
            isRequired: q.isRequired ?? false,
            displayOrder: q.displayOrder ?? i + 1,
            options: q.options ? (q.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            validationConfig: q.validationConfig
              ? (q.validationConfig as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            conditionalLogic: q.conditionalLogic
              ? (q.conditionalLogic as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            active: q.active ?? true,
          }));

          await tx.questionDefinition.createMany({
            data: questionRecords,
          });
        }

        // Update version timestamp
        await tx.questionnaireVersion.update({
          where: { id: versionId },
          data: { updatedAt: new Date() },
        });

        return tx.questionnaireVersion.findUnique({
          where: { id: versionId },
          include: {
            questions: {
              orderBy: { displayOrder: 'asc' },
            },
          },
        });
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );
  },

  async reorderQuestions(versionId: string, orders: Array<{ id: string; displayOrder: number }>) {
    return prisma.$transaction(async (tx) => {
      for (const item of orders) {
        await tx.questionDefinition.update({
          where: {
            id: item.id,
            versionId, // Safety check to prevent cross-version modifications
          },
          data: {
            displayOrder: item.displayOrder,
          },
        });
      }

      return tx.questionDefinition.findMany({
        where: { versionId },
        orderBy: { displayOrder: 'asc' },
      });
    });
  },

  async publishVersion(questionnaireId: string, versionId: string, publishedBy: string, changeLog?: string | null) {
    return prisma.$transaction(async (tx) => {
      // 1. Demote any currently active published version
      await tx.questionnaireVersion.updateMany({
        where: {
          questionnaireId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });

      // 2. Promote target version to PUBLISHED + isCurrent
      const updated = await tx.questionnaireVersion.update({
        where: { id: versionId },
        data: {
          status: QuestionnaireVersionStatus.PUBLISHED,
          isCurrent: true,
          publishedAt: new Date(),
          publishedBy,
          changeLog: changeLog !== undefined ? changeLog : undefined,
        },
        include: {
          questions: {
            orderBy: { displayOrder: 'asc' },
          },
        },
      });

      return updated;
    });
  },

  async deleteVersion(versionId: string) {
    return prisma.questionnaireVersion.delete({
      where: { id: versionId },
    });
  },
};
