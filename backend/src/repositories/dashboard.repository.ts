import {
  CustomerStatus,
  FollowUpStatus,
  CaseStatus,
  PushStatus,
  RecommendationStatus,
  Prisma,
} from '@prisma/client';
import BaseRepository from './base.repository.js';

export class DashboardRepository extends BaseRepository {
  async getDashboardData(
    scopedCustomerIds?: string[],
    scopedPartner?: { userId: string; aliases: string[] }
  ) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const customerScope = scopedCustomerIds !== undefined ? { id: { in: scopedCustomerIds } } : {};
    const fkScope = scopedCustomerIds !== undefined ? { customerId: { in: scopedCustomerIds } } : {};

    const followUpPartnerScope: Prisma.FollowUpWhereInput = scopedPartner
      ? {
          OR: [
            { assignedToUserId: scopedPartner.userId },
            ...(scopedPartner.aliases.length > 0
              ? [
                  {
                    assignedToUserId: null,
                    assignedTo: { in: scopedPartner.aliases },
                  },
                ]
              : []),
          ],
        }
      : {};

    const [
      totalCustomers,
      activeCustomers,
      openCases,
      pendingPushes,
      overdueCount,
      todayCount,
      newRecommendationsCount,
      overdueFollowUps,
      todayFollowUps,
      highPotentialRecs,
      newestRecs,
      recentActivities,
    ] = await Promise.all([
      // 1. Overview counts
      this.db.customer.count({
        where: customerScope,
      }),

      this.db.customer.count({
        where: { overallStatus: CustomerStatus.DANG_TU_VAN, ...customerScope },
      }),

      this.db.customerCase.count({
        where: {
          caseStatus: {
            in: [CaseStatus.DRAFT, CaseStatus.SUBMITTED, CaseStatus.UNDER_REVIEW],
          },
          ...fkScope,
        },
      }),

      this.db.pushRecord.count({
        where: {
          status: {
            in: [PushStatus.PENDING, PushStatus.IN_PROGRESS],
          },
          ...fkScope,
        },
      }),

      this.db.followUp.count({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { lt: now },
          ...fkScope,
          ...followUpPartnerScope,
        },
      }),

      this.db.followUp.count({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { gte: startOfDay, lte: endOfDay },
          ...fkScope,
          ...followUpPartnerScope,
        },
      }),

      this.db.recommendation.count({
        where: {
          status: { in: [RecommendationStatus.NEW, RecommendationStatus.ACTIVE] },
          ...fkScope,
        },
      }),

      // 2. Critical Today: Overdue Follow-ups
      this.db.followUp.findMany({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { lt: now },
          ...fkScope,
          ...followUpPartnerScope,
        },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              overallStatus: true,
              priority: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        take: 8,
      }),

      // 3. Critical Today: Today's Follow-ups
      this.db.followUp.findMany({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { gte: startOfDay, lte: endOfDay },
          ...fkScope,
          ...followUpPartnerScope,
        },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              overallStatus: true,
              priority: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        take: 8,
      }),

      // 4. Needs Attention: High-Potential Customers (highest rule-based scores)
      this.db.recommendation.findMany({
        where: {
          status: { in: [RecommendationStatus.NEW, RecommendationStatus.ACTIVE, RecommendationStatus.REVIEWED] },
          score: { not: null },
          ...fkScope,
        },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              overallStatus: true,
              priority: true,
            },
          },
          targetProduct: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }],
        take: 6,
      }),

      // 5. Recommendations: Newest Recommendation Opportunities
      this.db.recommendation.findMany({
        where: {
          status: { in: [RecommendationStatus.NEW, RecommendationStatus.ACTIVE] },
          ...fkScope,
        },
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              overallStatus: true,
              priority: true,
            },
          },
          targetProduct: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: { generatedAt: 'desc' },
        take: 6,
      }),

      // 6. Recent Activity Stream
      this.db.customerActivity.findMany({
        where: fkScope,
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: 8,
      }),
    ]);

    return {
      overview: {
        totalCustomers,
        activeCustomers,
        openCases,
        pendingPushes,
        overdueFollowUpsCount: overdueCount,
        todayFollowUpsCount: todayCount,
        newRecommendationsCount,
        highPotentialCount: highPotentialRecs.length,
      },
      criticalToday: {
        overdueFollowUps,
        todayFollowUps,
      },
      highPotentialCustomers: highPotentialRecs,
      newRecommendations: newestRecs,
      recentActivities,
    };
  }
}

export const dashboardRepository = new DashboardRepository();
export default dashboardRepository;
