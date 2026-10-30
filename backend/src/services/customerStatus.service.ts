import { CustomerCase, CaseProgress, CaseStatus, CustomerStatus, FollowUpStatus } from '@prisma/client';

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

export const CASE_PROGRESS_STEPS: CaseProgress[] = [
  CaseProgress.NOT_SELECTED,
  CaseProgress.REGISTRATION_CREATED,
  CaseProgress.REGISTRATION_COMPLETED,
  CaseProgress.UNDER_REVIEW,
  CaseProgress.APPROVED,
  CaseProgress.CARD_ISSUED,
  CaseProgress.CARD_ACTIVATED,
  CaseProgress.COMPLETED,
];

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
      assignedTo: f.assignedToUser?.fullName || f.assignedTo || null,
    };
  });

  const activeFollowUps = enrichedFollowUps.filter((f) => f.status !== 'CANCELLED');
  const completedFollowUps = enrichedFollowUps.filter((f) => f.status === 'COMPLETED');
  const pendingFollowUps = enrichedFollowUps.filter(
    (f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS' || f.effectiveStatus === 'OVERDUE'
  );

  let careCount = 0;
  if (followUps.length > 0) {
    careCount = activeFollowUps.length;
  } else if (customer._count?.followUps !== undefined) {
    careCount = Number(customer._count.followUps);
  }

  const completedCareCount = completedFollowUps.length;
  const pendingCareCount = pendingFollowUps.length;

  let latestCareStatus: 'COMPLETED' | 'PENDING' | 'OVERDUE' | 'IN_PROGRESS' | 'CANCELLED' | 'NONE' = 'NONE';
  if (careCount === 0) {
    latestCareStatus = followUps.length > 0 ? 'CANCELLED' : 'NONE';
  } else {
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

export type CustomerSurveyStatus = 'NOT_CREATED' | 'SENT' | 'COMPLETED';

export interface CustomerSurveyStats {
  surveyStatus: CustomerSurveyStatus;
  surveyStatusLabel: 'Chưa tạo link khảo sát' | 'Đã gửi khảo sát' | 'Khách đã điền khảo sát';
  totalAssessments: number;
  completedCount: number;
  activeLinkCount: number;
  expiredLinkCount: number;
  revokedLinkCount: number;
  hasDraftProgress: boolean;
  hasOpenedLink: boolean;
  hasExpiredOrRevokedLinks: boolean;
  latestInactiveLinkStatus: 'EXPIRED' | 'REVOKED' | null;
  latestCompletedAt: string | null;
  latestLinkCreatedAt: string | null;
  latestLinkExpiresAt: string | null;
}

/**
 * Computes the customer's survey status from real database assessment & publicSurveyLink records.
 * Rules (PHẦN 2):
 * 1. COMPLETED ("Khách đã điền khảo sát"): Has at least 1 valid completed Assessment (`status === 'COMPLETED'`).
 *    Takes priority even if a newer survey link was sent afterwards.
 * 2. SENT ("Đã gửi khảo sát"): No completed assessment yet, and has at least 1 active, non-expired, non-revoked
 *    public survey link (even if opened or partially answered/draft saved).
 * 3. NOT_CREATED ("Chưa tạo link khảo sát"): No completed assessment and no currently usable survey link.
 *    If previous links were all expired or revoked, returns `NOT_CREATED` with `hasExpiredOrRevokedLinks = true`
 *    and `latestInactiveLinkStatus` for tooltip display without deleting link history.
 */
export function computeCustomerSurveyStatus(
  assessments: any[] | null | undefined,
  akinatorSessionsOrNow?: any[] | Date | null,
  maybeNow: Date = new Date()
): CustomerSurveyStats {
  const list = Array.isArray(assessments) ? assessments : [];
  let akinatorList: any[] = [];
  let now: Date = maybeNow;

  if (akinatorSessionsOrNow instanceof Date) {
    now = akinatorSessionsOrNow;
  } else if (Array.isArray(akinatorSessionsOrNow)) {
    akinatorList = akinatorSessionsOrNow;
  }

  const nowMs = now.getTime();

  let completedCount = 0;
  let activeLinkCount = 0;
  let expiredLinkCount = 0;
  let revokedLinkCount = 0;
  let hasDraftProgress = false;
  let hasOpenedLink = false;
  let latestInactiveLinkStatus: 'EXPIRED' | 'REVOKED' | null = null;
  let latestCompletedAt: string | null = null;
  let latestLinkCreatedAt: string | null = null;
  let latestLinkExpiresAt: string | null = null;

  for (const a of list) {
    if (!a) continue;

    if (a.status === 'COMPLETED') {
      completedCount++;
      const compTime = a.completedAt || a.submittedAt || a.updatedAt || a.startedAt;
      if (compTime) {
        const iso = compTime instanceof Date ? compTime.toISOString() : String(compTime);
        if (!latestCompletedAt || new Date(iso).getTime() > new Date(latestCompletedAt).getTime()) {
          latestCompletedAt = iso;
        }
      }
    }

    const answerCount =
      typeof a._count?.answers === 'number'
        ? a._count.answers
        : Array.isArray(a.answers)
        ? a.answers.length
        : 0;

    const link = a.publicSurveyLink || a.publicLink;
    if (link) {
      const linkCreatedIso =
        link.createdAt instanceof Date
          ? link.createdAt.toISOString()
          : link.createdAt
          ? String(link.createdAt)
          : null;
      if (
        linkCreatedIso &&
        (!latestLinkCreatedAt || new Date(linkCreatedIso).getTime() > new Date(latestLinkCreatedAt).getTime())
      ) {
        latestLinkCreatedAt = linkCreatedIso;
      }

      if (a.status === 'COMPLETED' || link.status === 'COMPLETED') {
        continue;
      }

      const isRevoked =
        link.status === 'REVOKED' ||
        Boolean(link.revokedAt) ||
        link.isActive === false ||
        a.status === 'CANCELLED';
      const expiresMs = link.expiresAt ? new Date(link.expiresAt).getTime() : 0;
      const isExpired = !isRevoked && (link.status === 'EXPIRED' || (expiresMs > 0 && expiresMs <= nowMs));

      if (isRevoked) {
        revokedLinkCount++;
        if (!latestInactiveLinkStatus) {
          latestInactiveLinkStatus = 'REVOKED';
        }
      } else if (isExpired) {
        expiredLinkCount++;
        if (!latestInactiveLinkStatus) {
          latestInactiveLinkStatus = 'EXPIRED';
        }
      } else if ((link.status === 'ACTIVE' || link.isActive !== false) && a.status !== 'CANCELLED') {
        activeLinkCount++;
        if (!latestLinkExpiresAt && link.expiresAt) {
          latestLinkExpiresAt =
            link.expiresAt instanceof Date ? link.expiresAt.toISOString() : String(link.expiresAt);
        }
        if (link.lastAccessedAt || link.openedAt || a.status === 'IN_PROGRESS') {
          hasOpenedLink = true;
        }
        if (answerCount > 0 || a.status === 'IN_PROGRESS') {
          hasDraftProgress = true;
        }
      }
    } else if (a.status === 'IN_PROGRESS' && answerCount > 0) {
      hasDraftProgress = true;
    }
  }

  // 2. Process Akinator sessions for the customer (adaptive quiz flow)
  for (const s of akinatorList) {
    if (!s) continue;

    if (s.quizStatus === 'COMPLETED') {
      completedCount++;
      const compTime = s.completedAt || s.updatedAt || s.createdAt;
      if (compTime) {
        const iso = compTime instanceof Date ? compTime.toISOString() : String(compTime);
        if (!latestCompletedAt || new Date(iso).getTime() > new Date(latestCompletedAt).getTime()) {
          latestCompletedAt = iso;
        }
      }
      continue;
    }

    const createdIso =
      s.createdAt instanceof Date
        ? s.createdAt.toISOString()
        : s.createdAt
        ? String(s.createdAt)
        : null;
    if (
      createdIso &&
      (!latestLinkCreatedAt || new Date(createdIso).getTime() > new Date(latestLinkCreatedAt).getTime())
    ) {
      latestLinkCreatedAt = createdIso;
    }

    const isRevoked = s.quizStatus === 'REVOKED' || Boolean(s.revokedAt);
    const expiresMs = s.expiresAt ? new Date(s.expiresAt).getTime() : 0;
    const isExpired = !isRevoked && (s.quizStatus === 'EXPIRED' || (expiresMs > 0 && expiresMs <= nowMs));

    if (isRevoked) {
      revokedLinkCount++;
      if (!latestInactiveLinkStatus) {
        latestInactiveLinkStatus = 'REVOKED';
      }
    } else if (isExpired) {
      expiredLinkCount++;
      if (!latestInactiveLinkStatus) {
        latestInactiveLinkStatus = 'EXPIRED';
      }
    } else if (s.quizStatus === 'NOT_STARTED' || s.quizStatus === 'IN_PROGRESS') {
      activeLinkCount++;
      if (!latestLinkExpiresAt && s.expiresAt) {
        latestLinkExpiresAt =
          s.expiresAt instanceof Date ? s.expiresAt.toISOString() : String(s.expiresAt);
      }
      if (s.lastAccessedAt || s.quizStatus === 'IN_PROGRESS') {
        hasOpenedLink = true;
      }
      const rawAnsCount = typeof s._count?.rawAnswers === 'number' ? s._count.rawAnswers : 0;
      if (rawAnsCount > 0 || s.quizStatus === 'IN_PROGRESS') {
        hasDraftProgress = true;
      }
    }
  }

  let surveyStatus: CustomerSurveyStatus = 'NOT_CREATED';
  let surveyStatusLabel: CustomerSurveyStats['surveyStatusLabel'] = 'Chưa tạo link khảo sát';

  if (completedCount > 0) {
    surveyStatus = 'COMPLETED';
    surveyStatusLabel = 'Khách đã điền khảo sát';
  } else if (activeLinkCount > 0) {
    surveyStatus = 'SENT';
    surveyStatusLabel = 'Đã gửi khảo sát';
  } else {
    surveyStatus = 'NOT_CREATED';
    surveyStatusLabel = 'Chưa tạo link khảo sát';
  }

  return {
    surveyStatus,
    surveyStatusLabel,
    totalAssessments: list.length,
    completedCount,
    activeLinkCount,
    expiredLinkCount,
    revokedLinkCount,
    hasDraftProgress,
    hasOpenedLink,
    hasExpiredOrRevokedLinks: expiredLinkCount + revokedLinkCount > 0,
    latestInactiveLinkStatus,
    latestCompletedAt,
    latestLinkCreatedAt,
    latestLinkExpiresAt,
  };
}

/**
 * Attaches resolved status, care statistics, and survey statistics to customer object consistently for all API responses.
 */
export function enrichCustomerWithStatus<T extends CustomerWithCases>(
  customer: T,
  scopedPartner?: {
    userId: string;
    aliases?: string[];
    currentIds?: string[];
  }
): T & {
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
    isCurrentlyAssignedToMe?: boolean;
    isHistoricalForMe?: boolean;
    assignmentStatus?: 'CURRENT' | 'HISTORICAL';
    canEdit?: boolean;
  }>;
  assignedCaregivers: Array<{
    id: string;
    fullName: string;
    email?: string | null;
    role?: string;
    status?: string;
    assignedAt?: string | Date;
  }>;
  assignedCaregiverName: string;
  caregiverName: string;
  isCurrentlyAssignedToMe: boolean;
  isHistoricalForMe: boolean;
  assignmentStatus: 'CURRENT' | 'HISTORICAL';
  canEditCustomer: boolean;
  surveyStatus: CustomerSurveyStatus;
  surveyStatusLabel: string;
  surveyStats: CustomerSurveyStats;
} {
  if (!customer) return customer as any;

  const rawStatus = (customer as any).rawOverallStatus || (customer as any).careStatus || customer.overallStatus;
  const latestCase = getLatestCase(customer.cases);
  const resolvedStatus = latestCase && latestCase.progress ? latestCase.progress : customer.overallStatus;
  const careStats = resolveCustomerCareStats(customer);

  const rawAssignments = Array.isArray((customer as any).assignments) ? (customer as any).assignments : [];
  const rawGrants = Array.isArray((customer as any).assignmentGrants) ? (customer as any).assignmentGrants : [];
  const assignedCaregivers: Array<{
    id: string;
    fullName: string;
    email?: string | null;
    role?: string;
    status?: string;
    assignedAt?: string | Date;
  }> = [];

  for (const a of rawAssignments) {
    if (a && a.user && a.user.fullName) {
      if (!assignedCaregivers.some((item) => item.id === a.user.id)) {
        assignedCaregivers.push({
          id: a.user.id,
          fullName: a.user.fullName,
          email: a.user.email || null,
          role: a.user.role,
          status: a.user.status,
          assignedAt: a.assignedAt,
        });
      }
    }
  }

  let isCurrentlyAssignedToMe = true;
  let isHistoricalForMe = false;

  if (scopedPartner?.userId) {
    const partnerUserId = scopedPartner.userId;
    const hasActiveAssignment =
      rawAssignments.some((a: any) => (a.userId || a.user?.id) === partnerUserId) ||
      rawGrants.some((g: any) => g.userId === partnerUserId && g.active === true) ||
      Boolean(scopedPartner.currentIds && customer.id && scopedPartner.currentIds.includes(customer.id));

    isCurrentlyAssignedToMe = hasActiveAssignment;
    isHistoricalForMe = !hasActiveAssignment;
  }

  if (assignedCaregivers.length === 0 && !isHistoricalForMe) {
    const firstAssignedFollowUp = careStats.careFollowUps.find((f) => f.assignedTo && f.status !== 'CANCELLED');
    if (firstAssignedFollowUp?.assignedTo) {
      assignedCaregivers.push({
        id: 'legacy-followup-assignee',
        fullName: firstAssignedFollowUp.assignedTo,
      });
    }
  }

  const assignedCaregiverName =
    assignedCaregivers.length === 0
      ? 'Chưa phân công'
      : assignedCaregivers.length === 1
      ? assignedCaregivers[0].fullName
      : `${assignedCaregivers[0].fullName} (+${assignedCaregivers.length - 1})`;

  const aliasSetLower = new Set(
    (scopedPartner?.aliases || []).map((a) => a.trim().toLowerCase()).filter(Boolean)
  );

  const enrichFollowUpItem = (f: any) => {
    if (!scopedPartner?.userId) {
      return {
        ...f,
        isCurrentlyAssignedToMe: true,
        isHistoricalForMe: false,
        assignmentStatus: 'CURRENT' as const,
        canEdit: f.status !== 'COMPLETED' && f.status !== 'CANCELLED',
      };
    }

    const isDirectById = f.assignedToUserId === scopedPartner.userId;
    const isDirectByAlias =
      !f.assignedToUserId &&
      Boolean(f.assignedTo) &&
      aliasSetLower.has(String(f.assignedTo).trim().toLowerCase());
    const hasActiveScheduleGrant = rawGrants.some(
      (g: any) => g.sourceType === 'CARE_SCHEDULE' && g.sourceId === f.id && g.active === true
    );

    const isFuCurrent =
      (isDirectById || isDirectByAlias) && (isCurrentlyAssignedToMe || hasActiveScheduleGrant);
    const canEdit = isFuCurrent && f.status !== 'COMPLETED' && f.status !== 'CANCELLED';

    return {
      ...f,
      isCurrentlyAssignedToMe: isFuCurrent,
      isHistoricalForMe: !isFuCurrent,
      assignmentStatus: (isFuCurrent ? 'CURRENT' : 'HISTORICAL') as 'CURRENT' | 'HISTORICAL',
      canEdit,
    };
  };

  const enrichedRawFollowUps = Array.isArray((customer as any).followUps)
    ? (customer as any).followUps.map(enrichFollowUpItem)
    : (customer as any).followUps;

  const rawById = new Map<string, any>(
    Array.isArray(enrichedRawFollowUps) ? enrichedRawFollowUps.map((f: any) => [f.id, f]) : []
  );

  const enrichedCareFollowUps = careStats.careFollowUps.map((cf) => {
    const matched = rawById.get(cf.id);
    if (matched) {
      return {
        ...cf,
        isCurrentlyAssignedToMe: matched.isCurrentlyAssignedToMe,
        isHistoricalForMe: matched.isHistoricalForMe,
        assignmentStatus: matched.assignmentStatus,
        canEdit: matched.canEdit,
      };
    }
    return enrichFollowUpItem(cf);
  });

  const surveyStats = computeCustomerSurveyStatus(
    (customer as any).assessments,
    (customer as any).akinatorSessions,
    new Date()
  );

  return {
    ...customer,
    ...(enrichedRawFollowUps ? { followUps: enrichedRawFollowUps } : {}),
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
    careFollowUps: enrichedCareFollowUps,
    assignedCaregivers,
    assignedCaregiverName,
    caregiverName: assignedCaregiverName,
    isCurrentlyAssignedToMe,
    isHistoricalForMe,
    assignmentStatus: isCurrentlyAssignedToMe ? 'CURRENT' : 'HISTORICAL',
    canEditCustomer: isCurrentlyAssignedToMe,
    surveyStatus: surveyStats.surveyStatus,
    surveyStatusLabel: surveyStats.surveyStatusLabel,
    surveyStats,
  };
}

export const customerStatusService = {
  getLatestCase,
  resolveCustomerStatus,
  resolveCustomerCareStats,
  computeCustomerSurveyStatus,
  enrichCustomerWithStatus,
};

export default customerStatusService;
