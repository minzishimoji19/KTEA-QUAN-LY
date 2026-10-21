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

export interface CustomerCareStats {
  careCount: number;
  lastCareAt: string | null;
  latestCareStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED' | 'NONE';
  completedCareCount: number;
  pendingCareCount: number;
  careFollowUps: Array<{
    id: string;
    title: string;
    status: string;
    effectiveStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED';
    dueAt: string;
    completedAt: string | null;
    assignedTo: string | null;
  }>;
}

/**
 * Resolves care statistics for a customer:
 * - careCount: Total actual care tasks (non-cancelled FollowUps).
 *   Does not artificially jump from 0 to 1 only upon completion;
 *   preserves the exact count so updating status does NOT change the count.
 * - latestCareStatus: 'COMPLETED' (green), 'PENDING' (red), 'OVERDUE' (red), 'IN_PROGRESS' (blue), 'CANCELLED' (slate), 'NONE'
 * - lastCareAt: Timestamp of the most recent completed care task (or latest care activity)
 * - careFollowUps: Breakdown of individual care tasks with effective status
 */
export function resolveCustomerCareStats(customer: Record<string, any>): CustomerCareStats {
  const followUps: any[] = Array.isArray(customer.followUps) ? customer.followUps : [];
  const now = Date.now();

  const enrichedFollowUps = followUps.map((f: any) => {
    let effectiveStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED' = 'PENDING';
    if (f.status === 'COMPLETED') {
      effectiveStatus = 'COMPLETED';
    } else if (f.status === 'CANCELLED') {
      effectiveStatus = 'CANCELLED';
    } else {
      const dueTime = new Date(f.dueAt).getTime();
      if (!isNaN(dueTime) && dueTime < now) {
        effectiveStatus = 'OVERDUE';
      } else if (f.status === 'IN_PROGRESS') {
        effectiveStatus = 'IN_PROGRESS';
      } else {
        effectiveStatus = 'PENDING';
      }
    }

    return {
      id: String(f.id || ''),
      title: String(f.title || ''),
      status: String(f.status || 'PENDING'),
      effectiveStatus,
      dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : '',
      completedAt: f.completedAt ? new Date(f.completedAt).toISOString() : null,
      assignedTo: f.assignedTo || null,
    };
  });

  const activeFollowUps = enrichedFollowUps.filter((f) => f.status !== 'CANCELLED');
  const completedFollowUps = enrichedFollowUps.filter((f) => f.status === 'COMPLETED');
  const pendingFollowUps = enrichedFollowUps.filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS' || f.effectiveStatus === 'OVERDUE');

  // Care count:
  // If followUps are loaded, count non-cancelled care interactions.
  // Otherwise, fallback to _count.followUps if available.
  let careCount = 0;
  if (followUps.length > 0) {
    careCount = activeFollowUps.length;
  } else if (customer._count?.followUps !== undefined) {
    careCount = Number(customer._count.followUps);
  }

  const completedCareCount = completedFollowUps.length;
  const pendingCareCount = pendingFollowUps.length;

  // Determine overall / latest care status
  let latestCareStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED' | 'NONE' = 'NONE';
  if (careCount === 0) {
    latestCareStatus = followUps.length > 0 ? 'CANCELLED' : 'NONE';
  } else {
    // If any pending follow-up is overdue -> OVERDUE (highest priority warning)
    const hasOverdue = pendingFollowUps.some((f) => f.effectiveStatus === 'OVERDUE');
    if (hasOverdue) {
      latestCareStatus = 'OVERDUE';
    } else if (pendingFollowUps.some((f) => f.status === 'IN_PROGRESS')) {
      latestCareStatus = 'IN_PROGRESS';
    } else if (pendingFollowUps.length > 0) {
      latestCareStatus = 'PENDING';
    } else if (completedFollowUps.length > 0) {
      latestCareStatus = 'COMPLETED';
    }
  }

  // Determine last care timestamp: most recent completedAt, or fallback to most recent updatedAt/dueAt of completed
  let lastCareAt: string | null = null;
  if (completedFollowUps.length > 0) {
    const sortedCompleted = [...completedFollowUps].sort((a, b) => {
      const timeA = new Date(a.completedAt || a.dueAt).getTime();
      const timeB = new Date(b.completedAt || b.dueAt).getTime();
      return timeB - timeA;
    });
    const latest = sortedCompleted[0];
    const dateVal = latest.completedAt || latest.dueAt;
    if (dateVal) {
      lastCareAt = new Date(dateVal).toISOString();
    }
  }

  return {
    careCount,
    lastCareAt,
    latestCareStatus,
    completedCareCount,
    pendingCareCount,
    careFollowUps: enrichedFollowUps,
  };
}

/**
 * Attaches resolved status and care statistics to customer object consistently for all API responses.
 */
export function enrichCustomerWithStatus<T extends CustomerWithCases>(customer: T): T & {
  rawOverallStatus: string;
  careStatus: string;
  overallStatus: string;
  currentStatus: string;
  latestCase: any | null;
  careCount: number;
  lastCareAt: string | null;
  latestCareStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED' | 'NONE';
  completedCareCount: number;
  pendingCareCount: number;
  careFollowUps: Array<{
    id: string;
    title: string;
    status: string;
    effectiveStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED';
    dueAt: string;
    completedAt: string | null;
    assignedTo: string | null;
  }>;
} {
  const rawStatus = (customer as any).rawOverallStatus || (customer as any).careStatus || customer.overallStatus;
  const latestCase = getLatestCase(customer.cases);
  const resolvedStatus = latestCase && latestCase.progress ? latestCase.progress : customer.overallStatus;
  const careStats = resolveCustomerCareStats(customer);

  return {
    ...customer,
    rawOverallStatus: rawStatus,
    careStatus: rawStatus,
    overallStatus: resolvedStatus,
    currentStatus: resolvedStatus,
    latestCase: latestCase || null,
    careCount: careStats.careCount,
    lastCareAt: careStats.lastCareAt,
    latestCareStatus: careStats.latestCareStatus,
    completedCareCount: careStats.completedCareCount,
    pendingCareCount: careStats.pendingCareCount,
    careFollowUps: careStats.careFollowUps,
  };
}

export const customerStatusService = {
  getLatestCase,
  resolveCustomerStatus,
  resolveCustomerCareStats,
  enrichCustomerWithStatus,
};

export default customerStatusService;

