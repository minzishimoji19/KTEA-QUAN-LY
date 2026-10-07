import {
  CustomerStatus,
  FollowUpStatus,
  CaseStatus,
  PushStatus,
  RecommendationStatus,
} from '@prisma/client';
import BaseRepository from './base.repository.js';

export class DashboardRepository extends BaseRepository {
  async getDashboardData() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

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
      this.db.customer.count(),

      this.db.customer.count({
        where: { overallStatus: CustomerStatus.DANG_TU_VAN },
      }),

      this.db.customerCase.count({
        where: {
          caseStatus: {
            in: [CaseStatus.DRAFT, CaseStatus.SUBMITTED, CaseStatus.UNDER_REVIEW],
          },
        },
      }),

      this.db.pushRecord.count({
        where: {
          status: {
            in: [PushStatus.PENDING, PushStatus.IN_PROGRESS],
          },
        },
      }),

      this.db.followUp.count({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { lt: now },
        },
      }),

      this.db.followUp.count({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { gte: startOfDay, lte: endOfDay },
        },
      }),

      this.db.recommendation.count({
        where: {
          status: { in: [RecommendationStatus.NEW, RecommendationStatus.ACTIVE] },
        },
      }),

      // 2. Critical Today: Overdue Follow-ups
      this.db.followUp.findMany({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { lt: now },
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
