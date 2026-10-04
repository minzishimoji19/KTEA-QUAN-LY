import { analyticsRepository, DateFilterRange } from '../repositories/analytics.repository.js';
import BaseService from './base.service.js';

export class AnalyticsService extends BaseService {
  private parseDateRange(startDateStr?: string, endDateStr?: string): DateFilterRange {
    const range: DateFilterRange = {};
    if (startDateStr) {
      const d = new Date(startDateStr);
      if (!isNaN(d.getTime())) {
        d.setUTCHours(0, 0, 0, 0);
        range.startDate = d;
      }
    }
    if (endDateStr) {
      const d = new Date(endDateStr);
      if (!isNaN(d.getTime())) {
        d.setUTCHours(23, 59, 59, 999);
        range.endDate = d;
      }
    }
    return range;
  }

  private calcPercentage(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 1000) / 10;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  // 1. GET OVERVIEW METRICS
  async getOverview(startDate?: string, endDate?: string) {
    const range = this.parseDateRange(startDate, endDate);
    const data = await analyticsRepository.getOverviewMetrics(range);

    const totalCustomersInGroups = data.statusGroups.reduce(
      (acc, curr) => acc + curr._count.id,
      0
    );

    const customersByStatus = data.statusGroups.map((g) => ({
      status: g.overallStatus,
      count: g._count.id,
      percentage: this.calcPercentage(g._count.id, totalCustomersInGroups || data.totalCustomers),
    }));

    return {
      metrics: {
        totalCustomers: data.totalCustomers,
        newCustomersInPeriod: data.newCustomersInPeriod,
        activeCustomers: data.activeCustomers,
        customersWithActiveNeeds: data.customersWithActiveNeeds,
        customersRequiringFollowUp: data.customersRequiringFollowUp,
        overdueFollowUps: data.overdueFollowUps,
        totalCases: data.totalCases,
        successfulCases: data.successfulCases,
        failedCases: data.failedCases,
        pendingCases: data.pendingCases,
        pushCandidates: data.pushCandidates,
        totalPushes: data.totalPushes,
        successfulPushes: data.successfulPushes,
        failedPushes: data.failedPushes,
      },
      customersByStatus,
      period: {
        startDate: range.startDate ? range.startDate.toISOString() : null,
        endDate: range.endDate ? range.endDate.toISOString() : null,
      },
      definitions: {
        totalCustomers: 'Total customer records in the database across all time.',
        newCustomersInPeriod:
          'Count of verified customer profiles created within the selected date interval.',
        activeCustomers: 'Total registered customers currently designated with ACTIVE status.',
        customersWithActiveNeeds:
          'Count of distinct customers who have at least one need in OPEN or IN_PROGRESS status.',
        customersRequiringFollowUp:
          'Count of distinct customers who have at least one scheduled follow-up in PENDING or IN_PROGRESS status.',
        overdueFollowUps:
          'Total pending or in-progress follow-up reminders whose due date is earlier than current server time.',
        totalCases:
          'Total product application cases submitted, reviewed, or drafted within the period.',
        successfulCases: 'Application cases resolved with terminal outcome APPROVED.',
        failedCases: 'Application cases resolved with terminal outcome REJECTED.',
        pendingCases:
          'Application cases currently open in DRAFT, SUBMITTED, or UNDER_REVIEW status.',
        pushCandidates:
          'Distinct customers with ACTIVE rule recommendations eligible for referral push.',
        totalPushes: 'Total referral push records dispatched within the period.',
        successfulPushes: 'Referral pushes with confirmed terminal outcome SUCCESS.',
        failedPushes: 'Referral pushes with confirmed terminal outcome FAILED.',
      },
    };
  }

  // 2. GET CUSTOMER ANALYTICS
  async getCustomers(startDate?: string, endDate?: string) {
    const range = this.parseDateRange(startDate, endDate);
    const data = await analyticsRepository.getCustomerAnalytics(range);

    const totalCustomersInGroups = data.statusGroups.reduce(
      (acc, curr) => acc + curr._count.id,
      0
    );

    // Status breakdown
    const byStatus = data.statusGroups.map((g) => ({
      status: g.overallStatus,
      count: g._count.id,
      percentage: this.calcPercentage(g._count.id, totalCustomersInGroups),
    }));

    // Product breakdown
    const byProduct = data.productsWithCases.map((p) => {
      const distinctCusts = new Set(p.cases.map((c) => c.customerId));
      const approvedCount = p.cases.filter((c) => c.caseStatus === 'APPROVED').length;
      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        customerCount: distinctCusts.size,
        totalCases: p.cases.length,
        approvedCases: approvedCount,
      };
    });

    // Need breakdown
    const needCountsMap = new Map<string, { total: number; distinctCustomers: Set<string> }>();
    for (const item of data.needsWithCustomer) {
      if (!needCountsMap.has(item.needType)) {
        needCountsMap.set(item.needType, { total: 0, distinctCustomers: new Set() });
      }
      const entry = needCountsMap.get(item.needType)!;
      entry.total++;
      entry.distinctCustomers.add(item.customerId);
    }
    const totalNeedsCount = data.needsWithCustomer.length;
    const byNeed = Array.from(needCountsMap.entries())
      .map(([needType, val]) => ({
        needType,
        count: val.total,
        customerCount: val.distinctCustomers.size,
        percentage: this.calcPercentage(val.total, totalNeedsCount),
      }))
      .sort((a, b) => b.count - a.count);

    // Source breakdown
    const totalSourceCount = data.sourceGroups.reduce((acc, curr) => acc + curr._count.id, 0);
    const bySource = data.sourceGroups
      .map((g) => ({
        source: g.source || 'UNSPECIFIED',
        count: g._count.id,
        percentage: this.calcPercentage(g._count.id, totalSourceCount),
      }))
      .sort((a, b) => b.count - a.count);

    // Creation trend over time
    const trendMap = new Map<string, number>();
    for (const c of data.customersWithDates) {
      const dKey = this.formatDateKey(c.createdAt);
      trendMap.set(dKey, (trendMap.get(dKey) || 0) + 1);
    }
    const creationTrend = Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      summary: {
        totalCustomers: totalCustomersInGroups,
        activeCustomers:
          data.statusGroups.find((g) => g.overallStatus === 'ACTIVE')?._count.id || 0,
      },
      byStatus,
      byProduct,
      byNeed,
      bySource,
      creationTrend,
      period: {
        startDate: range.startDate ? range.startDate.toISOString() : null,
        endDate: range.endDate ? range.endDate.toISOString() : null,
      },
    };
  }

  // 3. GET CASE ANALYTICS
  async getCases(startDate?: string, endDate?: string) {
    const range = this.parseDateRange(startDate, endDate);
    const data = await analyticsRepository.getCaseAnalytics(range);

    const totalCasesCount = data.statusGroups.reduce((acc, curr) => acc + curr._count.id, 0);

    // Status breakdown
    const byStatus = data.statusGroups.map((g) => ({
      status: g.caseStatus,
      count: g._count.id,
      percentage: this.calcPercentage(g._count.id, totalCasesCount),
    }));

    // Cases by product
    const byProduct = data.productsWithCases.map((p) => {
      const approved = p.cases.filter((c) => c.caseStatus === 'APPROVED').length;
      const rejected = p.cases.filter((c) => c.caseStatus === 'REJECTED').length;
      const pending = p.cases.filter((c) =>
        ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(c.caseStatus)
      ).length;
      const resolved = approved + rejected;

      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        total: p.cases.length,
        approved,
        rejected,
        pending,
        approvalRateOnResolved: {
          value: resolved > 0 ? this.calcPercentage(approved, resolved) : 0,
          numerator: approved,
          denominator: resolved,
          definition: `Approved applications (${approved}) divided by total resolved applications (${resolved}: APPROVED + REJECTED) for ${p.name}.`,
        },
      };
    });

    // Success vs Failure
    const approvedCount =
      data.statusGroups.find((g) => g.caseStatus === 'APPROVED')?._count.id || 0;
    const rejectedCount =
      data.statusGroups.find((g) => g.caseStatus === 'REJECTED')?._count.id || 0;
    const cancelledCount =
      data.statusGroups.find((g) => g.caseStatus === 'CANCELLED')?._count.id || 0;
    const pendingCount = data.statusGroups
      .filter((g) => ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(g.caseStatus))
      .reduce((acc, curr) => acc + curr._count.id, 0);

    const resolvedTotal = approvedCount + rejectedCount + cancelledCount;

    const successVsFailure = {
      approved: approvedCount,
      rejected: rejectedCount,
      cancelled: cancelledCount,
      pending: pendingCount,
      resolvedTotal,
      approvalRateOnResolved: {
        value: resolvedTotal > 0 ? this.calcPercentage(approvedCount, resolvedTotal) : 0,
        numerator: approvedCount,
        denominator: resolvedTotal,
        definition:
          'Calculated strictly as approved cases divided by total resolved cases (APPROVED + REJECTED + CANCELLED). Pending, draft, and under-review cases are excluded.',
      },
      rejectionRateOnResolved: {
        value: resolvedTotal > 0 ? this.calcPercentage(rejectedCount, resolvedTotal) : 0,
        numerator: rejectedCount,
        denominator: resolvedTotal,
        definition:
          'Calculated strictly as rejected cases divided by total resolved cases (APPROVED + REJECTED + CANCELLED).',
      },
    };

    // Cases over time
    const timeMap = new Map<
      string,
      { total: number; approved: number; rejected: number; pending: number }
    >();
    for (const c of data.casesWithDates) {
      const d = c.applicationDate || c.createdAt;
      const dKey = this.formatDateKey(d);
      if (!timeMap.has(dKey)) {
        timeMap.set(dKey, { total: 0, approved: 0, rejected: 0, pending: 0 });
      }
      const entry = timeMap.get(dKey)!;
      entry.total++;
      if (c.caseStatus === 'APPROVED') entry.approved++;
      else if (c.caseStatus === 'REJECTED') entry.rejected++;
      else entry.pending++;
    }
    const casesOverTime = Array.from(timeMap.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top Failure Reasons
    const failureReasonMap = new Map<string, number>();
    for (const c of data.rejectedCases) {
      if (c.failureReason) {
        failureReasonMap.set(
          c.failureReason,
          (failureReasonMap.get(c.failureReason) || 0) + 1
        );
      }
    }
    const topFailureReasons = Array.from(failureReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalCases: totalCasesCount,
      byStatus,
      byProduct,
      successVsFailure,
      casesOverTime,
      topFailureReasons,
      period: {
        startDate: range.startDate ? range.startDate.toISOString() : null,
        endDate: range.endDate ? range.endDate.toISOString() : null,
      },
    };
  }

  // 4. GET NEED ANALYTICS
  async getNeeds(startDate?: string, endDate?: string) {
    const range = this.parseDateRange(startDate, endDate);
    const data = await analyticsRepository.getNeedAnalytics(range);

    // Aggregate by needType
    const needTypeMap = new Map<
      string,
      { total: number; open: number; inProgress: number; resolved: number; dropped: number }
    >();

    let totalNeeds = 0;
    for (const item of data.needStatusGroups) {
      const type = item.needType;
      const status = item.status;
      const count = item._count.id;
      totalNeeds += count;

      if (!needTypeMap.has(type)) {
        needTypeMap.set(type, { total: 0, open: 0, inProgress: 0, resolved: 0, dropped: 0 });
      }
      const entry = needTypeMap.get(type)!;
      entry.total += count;
      if (status === 'OPEN') entry.open += count;
      else if (status === 'IN_PROGRESS') entry.inProgress += count;
      else if (status === 'RESOLVED') entry.resolved += count;
      else if (status === 'DROPPED') entry.dropped += count;
    }

    const mostCommonNeeds = Array.from(needTypeMap.entries())
      .map(([needType, counts]) => ({
        needType,
        ...counts,
        percentage: this.calcPercentage(counts.total, totalNeeds),
      }))
      .sort((a, b) => b.total - a.total);

    const activeNeeds = mostCommonNeeds
      .map((n) => ({
        needType: n.needType,
        count: n.open + n.inProgress,
      }))
      .filter((n) => n.count > 0);

    const resolvedNeeds = mostCommonNeeds
      .map((n) => ({
        needType: n.needType,
        count: n.resolved + n.dropped,
      }))
      .filter((n) => n.count > 0);

    // Needs by Product mapping
    // Define standard financial mapping heuristics:
    const needToProductKeywords: Record<string, string[]> = {
      CREDIT_CARD: ['CC', 'CARD'],
      PERSONAL_LOAN: ['PERSONAL', 'UNSECURED'],
      SME_WORKING_CAPITAL: ['SME', 'CAPITAL'],
      HOME_PURCHASE: ['MORTGAGE', 'HOME', 'RESIDENTIAL'],
      SAVINGS_YIELD: ['DEPOSIT', 'SAVINGS', 'WEALTH'],
      PAYMENT_POS: ['POS', 'MERCHANT'],
    };

    const needsByProduct = mostCommonNeeds.map((need) => {
      const keywords = needToProductKeywords[need.needType] || [];
      const matchingProducts = data.productsCatalog.filter((prod) =>
        keywords.some(
          (kw) =>
            prod.code.toUpperCase().includes(kw) || prod.name.toUpperCase().includes(kw)
        )
      );

      const associatedCasesCount = matchingProducts.reduce(
        (acc, p) => acc + p.cases.length,
        0
      );

      return {
        needType: need.needType,
        relatedProducts: matchingProducts.map((p) => p.name),
        needCount: need.total,
        associatedCasesCount,
      };
    });

    // Trend over time
    const trendMap = new Map<string, number>();
    for (const item of data.allNeedsInPeriod) {
      const dKey = this.formatDateKey(item.detectedAt);
      trendMap.set(dKey, (trendMap.get(dKey) || 0) + 1);
    }
    const trendOverTime = Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalNeeds,
      mostCommonNeeds,
      activeNeeds,
      resolvedNeeds,
      needsByProduct,
      trendOverTime,
      period: {
        startDate: range.startDate ? range.startDate.toISOString() : null,
        endDate: range.endDate ? range.endDate.toISOString() : null,
      },
    };
  }

  // 5. GET PUSH ANALYTICS
  async getPush(startDate?: string, endDate?: string) {
    const range = this.parseDateRange(startDate, endDate);
    const data = await analyticsRepository.getPushAnalytics(range);

    const totalPushes = data.pushesCreated;

    // Push Result Distribution
    const resultDistribution = data.pushStatusGroups.map((g) => ({
      status: g.status,
      count: g._count.id,
      percentage: this.calcPercentage(g._count.id, totalPushes),
    }));

    // Recommendations by status
    const recommendationsByStatus = data.recommendationsByStatus.map((g) => ({
      status: g.status,
      count: g._count.id,
    }));

    // Pushes by Target Product
    const pushesByTargetProduct = data.productsWithPushes.map((p) => {
      const pushes = p.pushRecords;
      const success = pushes.filter((r) => r.status === 'SUCCESS').length;
      const failed = pushes.filter((r) => r.status === 'FAILED').length;
      const pending = pushes.filter((r) =>
        ['PENDING', 'IN_PROGRESS'].includes(r.status)
      ).length;
      const terminal = success + failed;

      return {
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        total: pushes.length,
        success,
        failed,
        pending,
        terminalSuccessRate: {
          value: terminal > 0 ? this.calcPercentage(success, terminal) : 0,
          numerator: success,
          denominator: terminal,
          definition: `Successful referrals (${success}) divided by terminal referrals (${terminal}) for ${p.name}.`,
        },
      };
    });

    // Overall push success metrics with explicit formulas
    const successfulPushes =
      data.pushStatusGroups.find((g) => g.status === 'SUCCESS')?._count.id || 0;
    const failedPushes =
      data.pushStatusGroups.find((g) => g.status === 'FAILED')?._count.id || 0;
    const pendingPushes = data.pushStatusGroups
      .filter((g) => ['PENDING', 'IN_PROGRESS'].includes(g.status))
      .reduce((acc, curr) => acc + curr._count.id, 0);

    const terminalPushes = successfulPushes + failedPushes;

    const pushSuccessMetrics = {
      totalPushes,
      successfulPushes,
      failedPushes,
      pendingPushes,
      terminalPushes,
      successRateOfTerminalPushes: {
        value: terminalPushes > 0 ? this.calcPercentage(successfulPushes, terminalPushes) : 0,
        numerator: successfulPushes,
        denominator: terminalPushes,
        definition:
          'Calculated strictly as successful referrals (status=SUCCESS) divided by all resolved/terminal referrals (SUCCESS + FAILED). Pending and in-progress referrals are excluded.',
      },
      successRateOfTotalPushes: {
        value: totalPushes > 0 ? this.calcPercentage(successfulPushes, totalPushes) : 0,
        numerator: successfulPushes,
        denominator: totalPushes,
        definition:
          'Calculated strictly as successful referrals (status=SUCCESS) divided by all initiated referrals (including PENDING, IN_PROGRESS, CANCELLED).',
      },
    };

    // Trend over time
    const timeMap = new Map<
      string,
      { total: number; success: number; failed: number; pending: number }
    >();
    for (const p of data.pushesWithDates) {
      const dKey = this.formatDateKey(p.pushedAt);
      if (!timeMap.has(dKey)) {
        timeMap.set(dKey, { total: 0, success: 0, failed: 0, pending: 0 });
      }
      const entry = timeMap.get(dKey)!;
      entry.total++;
      if (p.status === 'SUCCESS') entry.success++;
      else if (p.status === 'FAILED') entry.failed++;
      else entry.pending++;
    }
    const pushTrendOverTime = Array.from(timeMap.entries())
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top failure reasons for failed pushes
    const failureReasonMap = new Map<string, number>();
    for (const p of data.failedPushesWithReason) {
      if (p.failureReason) {
        failureReasonMap.set(
          p.failureReason,
          (failureReasonMap.get(p.failureReason) || 0) + 1
        );
      }
    }
    const topFailureReasons = Array.from(failureReasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      recommendationsGenerated: data.recommendationsGenerated,
      recommendationsByStatus,
      pushesCreated: totalPushes,
      resultDistribution,
      pushesByTargetProduct,
      pushSuccessMetrics,
      pushTrendOverTime,
      topFailureReasons,
      period: {
        startDate: range.startDate ? range.startDate.toISOString() : null,
        endDate: range.endDate ? range.endDate.toISOString() : null,
      },
    };
  }

  // 6. LIFECYCLE FOUNDATION
  async getLifecycleFoundation() {
    return analyticsRepository.getLifecycleFoundationMetrics();
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;

