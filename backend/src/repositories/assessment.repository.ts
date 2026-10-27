import prisma from '../config/database.js';
import { Assessment, AssessmentAnswer, AssessmentStatus, Prisma } from '@prisma/client';

export interface CreateAssessmentRepoInput {
  customerId: string;
  questionnaireVersionId: string;
  performedById?: string | null;
  notes?: string | null;
}

export const assessmentRepository = {
  async findByCustomerId(customerId: string) {
    return prisma.assessment.findMany({
      where: { customerId },
      include: {
        questionnaireVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            isCurrent: true,
            title: true,
            questionnaire: {
              select: {
                id: true,
                code: true,
                title: true,
              },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        _count: {
          select: { answers: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  },

  async findById(id: string) {
    return prisma.assessment.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            overallStatus: true,
          },
        },
        questionnaireVersion: {
          include: {
            questionnaire: true,
            questions: {
              where: { active: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        answers: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async create(data: CreateAssessmentRepoInput) {
    return prisma.assessment.create({
      data: {
        customerId: data.customerId,
        questionnaireVersionId: data.questionnaireVersionId,
        performedById: data.performedById,
        notes: data.notes,
        status: AssessmentStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: {
        questionnaireVersion: {
          include: {
            questionnaire: true,
            questions: {
              where: { active: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        performedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        answers: true,
      },
    });
  },

  async saveAnswers(
    assessmentId: string,
    answers: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>,
    notes?: string | null
  ) {
    return prisma.$transaction(
      async (tx) => {
        // 1. Update notes if provided
        await tx.assessment.update({
          where: { id: assessmentId },
          data: {
            notes: notes !== undefined ? notes : undefined,
            updatedAt: new Date(),
          },
        });

        // 2. Upsert answers concurrently
        await Promise.all(
          answers.map((item) =>
            tx.assessmentAnswer.upsert({
              where: {
                assessment_question_unique: {
                  assessmentId,
                  questionCode: item.questionCode,
                },
              },
              create: {
                assessmentId,
                questionId: item.questionId,
                questionCode: item.questionCode,
                answerValue: item.answerValue as unknown as Prisma.InputJsonValue,
              },
              update: {
                questionId: item.questionId,
                answerValue: item.answerValue as unknown as Prisma.InputJsonValue,
                updatedAt: new Date(),
              },
            })
          )
        );

        // Return full assessment
        return tx.assessment.findUnique({
          where: { id: assessmentId },
          include: {
            customer: true,
            questionnaireVersion: {
              include: {
                questionnaire: true,
                questions: {
                  where: { active: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
            answers: {
              orderBy: { createdAt: 'asc' },
            },
            performedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });
      },
      { timeout: 30000, maxWait: 10000 }
    );
  },

  async complete(assessmentId: string, notes?: string | null) {
    return prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: AssessmentStatus.COMPLETED,
        completedAt: new Date(),
        notes: notes !== undefined ? notes : undefined,
      },
      include: {
        customer: true,
        questionnaireVersion: {
          include: {
            questionnaire: true,
            questions: {
              where: { active: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        answers: true,
        performedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  },

  async cancel(assessmentId: string) {
    return prisma.assessment.update({
      where: { id: assessmentId },
      data: {
        status: AssessmentStatus.CANCELLED,
      },
    });
  },
};
