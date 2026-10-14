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
 * Attaches resolved status to customer object consistently for all API responses.
 */
export function enrichCustomerWithStatus<T extends CustomerWithCases>(customer: T): T & {
  overallStatus: string;
  currentStatus: string;
  latestCase: any | null;
} {
  const latestCase = getLatestCase(customer.cases);
  const resolvedStatus = latestCase && latestCase.progress ? latestCase.progress : customer.overallStatus;

  return {
    ...customer,
    overallStatus: resolvedStatus,
    currentStatus: resolvedStatus,
    latestCase: latestCase || null,
  };
}

export const customerStatusService = {
  getLatestCase,
  resolveCustomerStatus,
  enrichCustomerWithStatus,
};

export default customerStatusService;
