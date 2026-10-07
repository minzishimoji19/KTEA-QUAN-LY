import {
  CustomerStatus,
  NeedStatus,
  CaseStatus,
  FollowUpStatus,
  RecommendationStatus,
  PushStatus,
  Prisma,
} from '@prisma/client';
import BaseRepository from './base.repository.js';

export interface DateFilterRange {
  startDate?: Date;
  endDate?: Date;
}

export class AnalyticsRepository extends BaseRepository {
  private buildDateFilter(range: DateFilterRange): Prisma.DateTimeFilter | undefined {
    if (!range.startDate && !range.endDate) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (range.startDate) filter.gte = range.startDate;
    if (range.endDate) filter.lte = range.endDate;
    return filter;
  }

  // 1. OVERVIEW METRICS
  async getOverviewMetrics(range: DateFilterRange) {
    const dateFilter = this.buildDateFilter(range);

    const caseWhere: Prisma.CustomerCaseWhereInput = {};
    if (dateFilter) {
      caseWhere.createdAt = dateFilter;
    }

    const pushWhere: Prisma.PushRecordWhereInput = {};
    if (dateFilter) {
      pushWhere.pushedAt = dateFilter;
    }

    const [
      totalCustomers,
      newCustomersInPeriod,
      activeCustomers,
      statusGroups,
      customersWithActiveNeeds,
      customersRequiringFollowUp,
      overdueFollowUps,
      totalCases,
      successfulCases,
      failedCases,
      pendingCases,
      pushCandidates,
      totalPushes,
      successfulPushes,
      failedPushes,
    ] = await Promise.all([
      // Total customers all-time
      this.db.customer.count(),

      // New customers in period (or all-time if no date range specified)
      this.db.customer.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),

      // Customers being actively consulted (DANG_TU_VAN)
      this.db.customer.count({
        where: { overallStatus: CustomerStatus.DANG_TU_VAN },
      }),

      // Customers by status
      this.db.customer.groupBy({
        by: ['overallStatus'],
        _count: { id: true },
      }),

      // Customers with active needs (OPEN or IN_PROGRESS)
      this.db.customer.count({
        where: {
          needs: {
            some: {
              status: { in: [NeedStatus.OPEN, NeedStatus.IN_PROGRESS] },
            },
          },
        },
      }),

      // Customers requiring follow-up (PENDING or IN_PROGRESS)
      this.db.customer.count({
        where: {
          followUps: {
            some: {
              status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
            },
          },
        },
      }),

      // Overdue follow-ups
      this.db.followUp.count({
        where: {
          status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
          dueAt: { lt: new Date() },
        },
      }),

      // Total cases
      this.db.customerCase.count({ where: caseWhere }),

      // Successful cases (APPROVED)
      this.db.customerCase.count({
        where: {
          ...caseWhere,
          caseStatus: CaseStatus.APPROVED,
        },
      }),

      // Failed cases (REJECTED)
      this.db.customerCase.count({
        where: {
          ...caseWhere,
          caseStatus: CaseStatus.REJECTED,
        },
      }),

      // Pending cases (DRAFT, SUBMITTED, UNDER_REVIEW)
      this.db.customerCase.count({
        where: {
          ...caseWhere,
          caseStatus: {
            in: [CaseStatus.DRAFT, CaseStatus.SUBMITTED, CaseStatus.UNDER_REVIEW],
          },
        },
      }),

      // Push candidates (customers with active recommendations not yet dismissed or accepted)
      this.db.customer.count({
        where: {
          recommendations: {
            some: {
              status: RecommendationStatus.ACTIVE,
            },
          },
        },
      }),

      // Total pushes
      this.db.pushRecord.count({ where: pushWhere }),

      // Successful pushes
      this.db.pushRecord.count({
        where: {
          ...pushWhere,
          status: PushStatus.SUCCESS,
        },
      }),

      // Failed pushes
      this.db.pushRecord.count({
        where: {
          ...pushWhere,
          status: PushStatus.FAILED,
        },
      }),
    ]);

    return {
      totalCustomers,
      newCustomersInPeriod,
      activeCustomers,
      statusGroups,
      customersWithActiveNeeds,
      customersRequiringFollowUp,
      overdueFollowUps,
      totalCases,
      successfulCases,
      failedCases,
      pendingCases,
      pushCandidates,
      totalPushes,
      successfulPushes,
      failedPushes,
    };
  }

  // 2. CUSTOMER ANALYTICS
  async getCustomerAnalytics(range: DateFilterRange) {
    const dateFilter = this.buildDateFilter(range);

    const [statusGroups, sourceGroups, customersWithDates, productsWithCases, needsWithCustomer] =
      await Promise.all([
        // Customers by status
        this.db.customer.groupBy({
          by: ['overallStatus'],
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          _count: { id: true },
        }),

        // Customers by source
        this.db.customer.groupBy({
          by: ['source'],
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          _count: { id: true },
        }),

        // Customers created dates for trend
        this.db.customer.findMany({
          where: dateFilter ? { createdAt: dateFilter } : undefined,
          select: {
            id: true,
            createdAt: true,
            overallStatus: true,
          },
          orderBy: { createdAt: 'asc' },
        }),

        // Products with cases to find customers by product
        this.db.product.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            cases: {
              where: dateFilter ? { createdAt: dateFilter } : undefined,
              select: {
                customerId: true,
                caseStatus: true,
              },
            },
          },
        }),

        // Customer needs with customer info
        this.db.customerNeed.findMany({
          where: dateFilter ? { detectedAt: dateFilter } : undefined,
          select: {
            customerId: true,
            needType: true,
            status: true,
          },
        }),
      ]);

    return {
      statusGroups,
      sourceGroups,
      customersWithDates,
      productsWithCases,
      needsWithCustomer,
    };
  }

  // 3. CASE ANALYTICS
  async getCaseAnalytics(range: DateFilterRange) {
    const dateFilter = this.buildDateFilter(range);

    const caseWhere: Prisma.CustomerCaseWhereInput = {};
    if (dateFilter) {
      caseWhere.createdAt = dateFilter;
    }

    const [statusGroups, productsWithCases, casesWithDates, rejectedCases] = await Promise.all([
      // Cases by status
      this.db.customerCase.groupBy({
        by: ['caseStatus'],
        where: caseWhere,
        _count: { id: true },
      }),

      // Cases by product
      this.db.product.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          cases: {
            where: caseWhere,
            select: {
              id: true,
              caseStatus: true,
            },
          },
        },
      }),

      // Cases over time
      this.db.customerCase.findMany({
        where: caseWhere,
        select: {
          id: true,
          caseStatus: true,
          createdAt: true,
          applicationDate: true,
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Failure reasons for rejected cases
      this.db.customerCase.findMany({
        where: {
          ...caseWhere,
          caseStatus: CaseStatus.REJECTED,
          failureReason: { not: null },
        },
        select: {
          failureReason: true,
        },
      }),
    ]);

    return {
      statusGroups,
      productsWithCases,
      casesWithDates,
      rejectedCases,
    };
  }

  // 4. NEED ANALYTICS
  async getNeedAnalytics(range: DateFilterRange) {
    const dateFilter = this.buildDateFilter(range);

    const needWhere: Prisma.CustomerNeedWhereInput = {};
    if (dateFilter) {
      needWhere.detectedAt = dateFilter;
    }

    const [needStatusGroups, allNeedsInPeriod, productsCatalog] = await Promise.all([
      // Group by needType and status
      this.db.customerNeed.groupBy({
        by: ['needType', 'status'],
        where: needWhere,
        _count: { id: true },
      }),

      // All needs in period for timeline trend
      this.db.customerNeed.findMany({
        where: needWhere,
        select: {
          id: true,
          needType: true,
          status: true,
          detectedAt: true,
          resolvedAt: true,
          customerId: true,
        },
        orderBy: { detectedAt: 'asc' },
      }),

      // Products catalog for product-need correlation
      this.db.product.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          cases: {
            select: {
              customerId: true,
              caseStatus: true,
            },
          },
        },
      }),
    ]);

    return {
      needStatusGroups,
      allNeedsInPeriod,
      productsCatalog,
    };
  }

  // 5. PUSH ANALYTICS
  async getPushAnalytics(range: DateFilterRange) {
    const dateFilter = this.buildDateFilter(range);

    const pushWhere: Prisma.PushRecordWhereInput = {};
    if (dateFilter) {
      pushWhere.pushedAt = dateFilter;
    }

    const recWhere: Prisma.RecommendationWhereInput = {};
    if (dateFilter) {
      recWhere.generatedAt = dateFilter;
    }

    const [
      recommendationsGenerated,
      recommendationsByStatus,
      pushesCreated,
      pushStatusGroups,
      productsWithPushes,
      pushesWithDates,
      failedPushesWithReason,
    ] = await Promise.all([
      // Total recommendations generated in period
      this.db.recommendation.count({ where: recWhere }),

      // Recommendations by status
      this.db.recommendation.groupBy({
        by: ['status'],
        where: recWhere,
        _count: { id: true },
      }),

      // Total pushes created in period
      this.db.pushRecord.count({ where: pushWhere }),

      // Pushes by status
      this.db.pushRecord.groupBy({
        by: ['status'],
        where: pushWhere,
        _count: { id: true },
      }),

      // Pushes by target product
      this.db.product.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          pushRecords: {
            where: pushWhere,
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),

      // Push trend over time
      this.db.pushRecord.findMany({
        where: pushWhere,
        select: {
          id: true,
          status: true,
          pushedAt: true,
          resultAt: true,
        },
        orderBy: { pushedAt: 'asc' },
      }),

      // Failed pushes with reason
      this.db.pushRecord.findMany({
        where: {
          ...pushWhere,
          status: PushStatus.FAILED,
          failureReason: { not: null },
        },
        select: {
          failureReason: true,
        },
      }),
    ]);

    return {
      recommendationsGenerated,
      recommendationsByStatus,
      pushesCreated,
      pushStatusGroups,
      productsWithPushes,
      pushesWithDates,
      failedPushesWithReason,
    };
  }

  // 6. LIFECYCLE FOUNDATION METRICS (Distinguishing Customers vs Cases)
  async getLifecycleFoundationMetrics() {
    const [
      totalCustomers,
      totalCases,
      casesByStatusGroups,
      casesByProgressGroups,
      casesWithCustomer,
      customersBySourceGroups,
      cardActivatedCount,
    ] = await Promise.all([
      this.db.customer.count(),
      this.db.customerCase.count(),
      this.db.customerCase.groupBy({
        by: ['caseStatus'],
        _count: { id: true },
      }),
      this.db.customerCase.groupBy({
        by: ['progress'],
        _count: { id: true },
      }),
      this.db.customerCase.findMany({
        select: {
          id: true,
          caseStatus: true,
          progress: true,
          customer: {
            select: {
              source: true,
              sourceId: true,
              customerSource: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.db.customer.groupBy({
        by: ['source'],
        _count: { id: true },
      }),
      this.db.customerCase.count({
        where: {
          progress: { in: ['CARD_ACTIVATED', 'COMPLETED'] },
        },
      }),
    ]);

    const casesByStatus = casesByStatusGroups.map((g) => ({
      status: g.caseStatus,
      count: g._count.id,
    }));

    const casesByProgress = casesByProgressGroups.map((g) => ({
      progress: g.progress,
      count: g._count.id,
    }));

    const sourceCountMap: Record<string, number> = {};
    for (const c of casesWithCustomer) {
      const src = c.customer?.customerSource?.name || c.customer?.source || 'Direct';
      sourceCountMap[src] = (sourceCountMap[src] || 0) + 1;
    }
    const casesBySource = Object.entries(sourceCountMap).map(([source, count]) => ({
      source,
      count,
    }));

    const customersBySource = customersBySourceGroups.map((g) => ({
      source: g.source || 'Direct',
      count: g._count.id,
    }));

    const approvedCases = casesByStatus.find((s) => s.status === 'APPROVED')?.count || 0;
    const rejectedCases = casesByStatus.find((s) => s.status === 'REJECTED')?.count || 0;
    const completedCases = casesByStatus.find((s) => s.status === 'COMPLETED')?.count || 0;

    const activationRate = approvedCases > 0
      ? Number(((cardActivatedCount / approvedCases) * 100).toFixed(2))
      : 0;

    return {
      totalCustomers,
      totalCases,
      casesByStatus,
      casesByProgress,
      casesBySource,
      customersBySource,
      approvedCases,
      rejectedCases,
      completedCases,
      activationRate,
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();
export default analyticsRepository;

