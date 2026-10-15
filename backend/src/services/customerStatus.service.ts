import { CustomerCase, CaseProgress, CustomerStatus } from '@prisma/client';

export interface CustomerWithCases {
  id?: string;
  overallStatus: CustomerStatus | string;
  cases?: Array<{
    id: string;
    progress: CaseProgress | string;
    createdAt: Date | string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

/**
 * Determines the latest case for a customer.
 * 
 * Business Rules:
 * 1. Primary sorting criteria: createdAt DESC (creation time of the case).
 * 2. Strict rule: updatedAt must NEVER be used as primary, as updating an old case
 *    does not make it the newest case.
 * 3. Stable secondary tie-breaker: id DESC when cases have the exact same createdAt.
 */
export function getLatestCase<T extends { id: string; createdAt: Date | string }>(
  cases?: T[] | null
): T | null {
  if (!cases || cases.length === 0) return null;

  const sorted = [...cases].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) {
      return timeB - timeA; // Newest first
    }
    // Stable tie-breaker on id descending
    return String(b.id).localeCompare(String(a.id));
  });

  return sorted[0] || null;
}

/**
 * Resolves the customer's current status:
 * - If customer has one or more cases, the current status is the status (progress) of their latest case.
 *   (One of the 8 CaseProgress states: NOT_SELECTED, REGISTRATION_CREATED, REGISTRATION_COMPLETED,
 *   UNDER_REVIEW, APPROVED, CARD_ISSUED, CARD_ACTIVATED, COMPLETED).
 * - If customer has no cases, retains their existing lifecycle status (e.g. LEAD_MOI, DANG_TIEP_CAN, etc.)
 *   without assigning any fake case status.
 */
export function resolveCustomerStatus(customer: CustomerWithCases): string {
  const latestCase = getLatestCase(customer.cases);
  if (latestCase && latestCase.progress) {
    return latestCase.progress;
  }
  return customer.overallStatus;
}

/**
 * Resolves care statistics for a customer:
 * - careCount: Total number of completed care tasks (FollowUp with status === COMPLETED).
 *   Pending, upcoming, and cancelled follow-ups are strictly excluded.
 * - lastCareAt: Timestamp of the most recent completed care task.
 *   Does not use customer.updatedAt.
 *   Returns null if customer has no completed care interactions.
 */
export function resolveCustomerCareStats(customer: Record<string, any>): {
  careCount: number;
  lastCareAt: string | null;
} {
  let careCount = 0;
  let lastCareAt: string | null = null;

  if (customer._count?.followUps !== undefined) {
    careCount = Number(customer._count.followUps);
  }

  if (Array.isArray(customer.followUps) && customer.followUps.length > 0) {
    const completedFollowUps = customer.followUps
      .filter((f: any) => f && f.status === 'COMPLETED')
      .sort((a: any, b: any) => {
        const timeA = new Date(a.completedAt || a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.completedAt || b.updatedAt || b.createdAt).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

    if (customer._count?.followUps === undefined) {
      careCount = completedFollowUps.length;
    }

    if (completedFollowUps.length > 0) {
      const latest = completedFollowUps[0];
      const dateVal = latest.completedAt || latest.updatedAt;
      if (dateVal) {
        lastCareAt = new Date(dateVal).toISOString();
      }
    }
  }

  return { careCount, lastCareAt };
}

/**
 * Attaches resolved status and care statistics to customer object consistently for all API responses.
 */
export function enrichCustomerWithStatus<T extends CustomerWithCases>(customer: T): T & {
  overallStatus: string;
  currentStatus: string;
  latestCase: any | null;
  careCount: number;
  lastCareAt: string | null;
} {
  const latestCase = getLatestCase(customer.cases);
  const resolvedStatus = latestCase && latestCase.progress ? latestCase.progress : customer.overallStatus;
  const careStats = resolveCustomerCareStats(customer);

  return {
    ...customer,
    overallStatus: resolvedStatus,
    currentStatus: resolvedStatus,
    latestCase: latestCase || null,
    careCount: careStats.careCount,
    lastCareAt: careStats.lastCareAt,
  };
}

export const customerStatusService = {
  getLatestCase,
  resolveCustomerStatus,
  resolveCustomerCareStats,
  enrichCustomerWithStatus,
};

export default customerStatusService;

