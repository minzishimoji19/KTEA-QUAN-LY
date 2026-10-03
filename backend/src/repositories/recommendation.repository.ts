import { Prisma, RecommendationStatus } from '@prisma/client';
import BaseRepository from './base.repository.js';

export interface RecommendationQueryFilters {
  status?: RecommendationStatus;
  minScore?: number;
  productId?: string;
}

export class RecommendationRepository extends BaseRepository {
  async findAll(filters?: RecommendationQueryFilters) {
    const where: Prisma.RecommendationWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.minScore !== undefined) {
      where.score = { gte: filters.minScore };
    }

    if (filters?.productId) {
      where.targetProductId = filters.productId;
    }

    return this.db.recommendation.findMany({
      where,
      include: {
        customer: {
          include: {
            cases: {
              include: { product: true },
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
            followUps: {
              where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
              orderBy: { dueAt: 'asc' },
              take: 1,
            },
            activities: {
              orderBy: { occurredAt: 'desc' },
              take: 1,
            },
            needs: {
              where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
            },
          },
        },
        targetProduct: true,
        pushRecords: {
          orderBy: { pushedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }],
    });
  }

  async findByCustomerId(customerId: string) {
    return this.db.recommendation.findMany({
      where: { customerId },
      include: {
        targetProduct: true,
        pushRecords: true,
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.db.recommendation.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            cases: { include: { product: true } },
            followUps: true,
            activities: { orderBy: { occurredAt: 'desc' }, take: 5 },
            needs: true,
          },
        },
        targetProduct: true,
        pushRecords: true,
      },
    });
  }

  async create(data: {
    customerId: string;
    targetProductId?: string | null;
    recommendationType: string;
    score?: number | null;
    reason: string;
    status?: RecommendationStatus;
  }) {
    return this.db.recommendation.create({
      data: {
        customerId: data.customerId,
        targetProductId: data.targetProductId,
        recommendationType: data.recommendationType,
        score: data.score !== undefined && data.score !== null ? data.score : null,
        reason: data.reason,
        status: data.status || RecommendationStatus.NEW,
      },
      include: {
        customer: true,
        targetProduct: true,
      },
    });
  }

  async update(id: string, data: Prisma.RecommendationUpdateInput) {
    return this.db.recommendation.update({
      where: { id },
      data,
      include: {
        customer: true,
        targetProduct: true,
        pushRecords: true,
      },
    });
  }

  async findCustomerWithRelations(customerId: string) {
    return this.db.customer.findUnique({
      where: { id: customerId },
      include: {
        needs: true,
        cases: { include: { product: true } },
        activities: { orderBy: { occurredAt: 'desc' } },
        pushRecords: true,
        recommendations: true,
      },
    });
  }

  async findAllCustomersWithRelations() {
    return this.db.customer.findMany({
      include: {
        needs: true,
        cases: { include: { product: true } },
        activities: { orderBy: { occurredAt: 'desc' }, take: 10 },
        pushRecords: true,
        recommendations: true,
      },
    });
  }
}

export const recommendationRepository = new RecommendationRepository();
export default recommendationRepository;
