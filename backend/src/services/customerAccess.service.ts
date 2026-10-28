import prisma from '../config/database.js';
import { AssignmentSourceType, FollowUpStatus, Role } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export interface UserContext {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export type AssignmentScopeFilter = 'all' | 'current' | 'historical';

export interface PartnerCustomerScope {
  userId: string;
  fullName: string;
  email: string;
  aliases: string[];
  currentIds: string[];
  historicalIds: string[];
  allIds: string[];
  grantedFollowUpIds: string[];
  activeGrantedFollowUpIds: string[];
  historicalGrantedFollowUpIds: string[];
}

export class CustomerAccessService {
  /**
   * Retrieves all customer IDs CURRENTLY assigned to a specific user (`customer_assignments`).
   */
  async getAssignedCustomerIds(userId: string): Promise<string[]> {
    const assignments = await prisma.customerAssignment.findMany({
      where: { userId },
      select: { customerId: true },
    });
    return assignments.map((a) => a.customerId);
  }

  /**
   * Retrieves the Partner user's identity and any linked Caretaker names for schedule-level RBAC scoping.
   */
  async getPartnerCaregiverScope(userId: string): Promise<{
    userId: string;
    fullName: string;
    email: string;
    aliases: string[];
  }> {
    const [user, linkedCaretakers] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, email: true },
      }),
      prisma.caretaker.findMany({
        where: { userId },
        select: { name: true },
      }),
    ]);

    const aliasSet = new Set<string>();
    if (user?.fullName?.trim()) aliasSet.add(user.fullName.trim());
    if (user?.email?.trim()) aliasSet.add(user.email.trim());
    for (const ct of linkedCaretakers) {
      if (ct.name?.trim()) aliasSet.add(ct.name.trim());
    }

    return {
      userId,
      fullName: user?.fullName || '',
      email: user?.email || '',
      aliases: Array.from(aliasSet),
    };
  }

  /**
   * Computes complete current + historical customer and care-schedule scope for a PARTNER user.
   */
  async getPartnerCustomerScope(userId: string): Promise<PartnerCustomerScope> {
    const caregiverScope = await this.getPartnerCaregiverScope(userId);
    const { aliases } = caregiverScope;

    const followUpOwnerOr: Array<Record<string, unknown>> = [{ assignedToUserId: userId }];
    if (aliases.length > 0) {
      followUpOwnerOr.push({
        assignedToUserId: null,
        assignedTo: { in: aliases },
      });
    }

    const [activeAssignments, allGrants, ownedFollowUps] = await Promise.all([
      prisma.customerAssignment.findMany({
        where: { userId },
        select: { customerId: true },
      }),
      prisma.customerAssignmentGrant.findMany({
        where: { userId },
        select: {
          customerId: true,
          sourceType: true,
          sourceId: true,
          active: true,
        },
      }),
      prisma.followUp.findMany({
        where: { OR: followUpOwnerOr },
        select: { id: true, customerId: true },
      }),
    ]);

    const currentCustomerSet = new Set(activeAssignments.map((a) => a.customerId));
    for (const g of allGrants) {
      if (g.active) {
        currentCustomerSet.add(g.customerId);
      }
    }

    const allCustomerSet = new Set<string>(currentCustomerSet);
    const grantedFollowUpSet = new Set<string>();
    const activeGrantedFollowUpSet = new Set<string>();
    const historicalGrantedFollowUpSet = new Set<string>();

    for (const g of allGrants) {
      allCustomerSet.add(g.customerId);
      if (g.sourceType === AssignmentSourceType.CARE_SCHEDULE && g.sourceId) {
        grantedFollowUpSet.add(g.sourceId);
        if (g.active) {
          activeGrantedFollowUpSet.add(g.sourceId);
        } else {
          historicalGrantedFollowUpSet.add(g.sourceId);
        }
      }
    }

    for (const fu of ownedFollowUps) {
      allCustomerSet.add(fu.customerId);
      grantedFollowUpSet.add(fu.id);
      if (currentCustomerSet.has(fu.customerId)) {
        activeGrantedFollowUpSet.add(fu.id);
      } else {
        historicalGrantedFollowUpSet.add(fu.id);
      }
    }

    const currentIds = Array.from(currentCustomerSet);
    const allIds = Array.from(allCustomerSet);
    const historicalIds = allIds.filter((id) => !currentCustomerSet.has(id));

    return {
      ...caregiverScope,
      currentIds,
      historicalIds,
      allIds,
      grantedFollowUpIds: Array.from(grantedFollowUpSet),
      activeGrantedFollowUpIds: Array.from(activeGrantedFollowUpSet),
      historicalGrantedFollowUpIds: Array.from(historicalGrantedFollowUpSet).filter(
        (id) => !activeGrantedFollowUpSet.has(id)
      ),
    };
  }

  /**
   * Evaluates whether a user can view a customer (currently assigned OR historically assigned).
   */
  async canViewHistoricalCustomer(
    user: { id: string; role: Role },
    customerId: string
  ): Promise<{ canView: boolean; isCurrent: boolean; isHistorical: boolean }> {
    if (user.role === Role.ADMIN) {
      return { canView: true, isCurrent: true, isHistorical: false };
    }

    const [activeAssignment, anyGrant] = await Promise.all([
      prisma.customerAssignment.findUnique({
        where: {
          customerId_userId: {
            customerId,
            userId: user.id,
          },
        },
      }),
      prisma.customerAssignmentGrant.findFirst({
        where: {
          customerId,
          userId: user.id,
        },
        orderBy: { active: 'desc' },
      }),
    ]);

    if (activeAssignment || (anyGrant && anyGrant.active)) {
      return { canView: true, isCurrent: true, isHistorical: false };
    }

    if (anyGrant) {
      return { canView: true, isCurrent: false, isHistorical: true };
    }

    // Fallback: check if partner has any follow-up directly referencing them on this customer
    const scope = await this.getPartnerCaregiverScope(user.id);
    const followUpOr: Array<Record<string, unknown>> = [{ assignedToUserId: user.id }];
    if (scope.aliases.length > 0) {
      followUpOr.push({
        assignedToUserId: null,
        assignedTo: { in: scope.aliases },
      });
    }

    const historicalFollowUp = await prisma.followUp.findFirst({
      where: {
        customerId,
        OR: followUpOr,
      },
      select: { id: true },
    });

    if (historicalFollowUp) {
      return { canView: true, isCurrent: false, isHistorical: true };
    }

    return { canView: false, isCurrent: false, isHistorical: false };
  }

  /**
   * Evaluates whether a user has active edit rights on a customer (currently assigned only).
   */
  async canEditCurrentlyAssignedCustomer(
    user: { id: string; role: Role },
    customerId: string
  ): Promise<boolean> {
    if (user.role === Role.ADMIN) {
      return true;
    }
    const access = await this.canViewHistoricalCustomer(user, customerId);
    return access.canView && access.isCurrent;
  }

  /**
   * Checks if user has read access to a specific customer (current or historical).
   */
  async canAccessCustomer(user: { id: string; role: Role }, customerId: string): Promise<boolean> {
    const access = await this.canViewHistoricalCustomer(user, customerId);
    return access.canView;
  }

  /**
   * Asserts READ access to customer (current OR historical).
   * Throws NotFoundError (404) if customer is completely outside the Partner's current & historical scope.
   */
  async assertCustomerAccess(
    user: { id: string; role: Role },
    customerId: string
  ): Promise<{ isCurrent: boolean; isHistorical: boolean }> {
    const access = await this.canViewHistoricalCustomer(user, customerId);
    if (!access.canView) {
      throw new NotFoundError(`Khách hàng không tồn tại hoặc bạn không có quyền truy cập.`);
    }
    return { isCurrent: access.isCurrent, isHistorical: access.isHistorical };
  }

  /**
   * Asserts WRITE/EDIT access to customer (currently assigned ONLY).
   * Throws 404 if never assigned, or 403 Forbidden if only historically assigned (read-only).
   */
  async assertCustomerWriteAccess(user: { id: string; role: Role }, customerId: string): Promise<void> {
    if (user.role === Role.ADMIN) {
      return;
    }
    const access = await this.canViewHistoricalCustomer(user, customerId);
    if (!access.canView) {
      throw new NotFoundError(`Khách hàng không tồn tại hoặc bạn không có quyền truy cập.`);
    }
    if (!access.isCurrent) {
      throw new ForbiddenError(
        'Khách hàng này thuộc lịch sử phân công đã chuyển giao hoặc kết thúc. Bạn chỉ có quyền xem lịch sử và không được chỉnh sửa.'
      );
    }
  }

  /**
   * Evaluates whether a user can view a care schedule (`FollowUp`) and whether they can edit it.
   * Enforces strict schedule-level isolation:
   * - Partner can view schedules currently assigned to them OR previously assigned to them.
   * - Partner CANNOT view schedules only assigned to another Partner, even on the same customer.
   * - Partner can ONLY edit/complete schedules currently assigned to them.
   */
  async canViewHistoricalSchedule(
    user: { id: string; role: Role },
    followUpId: string
  ): Promise<{
    canView: boolean;
    canEdit: boolean;
    isCurrent: boolean;
    isHistorical: boolean;
    customerId: string;
    status: FollowUpStatus;
  }> {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      select: {
        id: true,
        customerId: true,
        status: true,
        assignedToUserId: true,
        assignedTo: true,
      },
    });

    if (!followUp) {
      throw new NotFoundError(`Lịch chăm sóc không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    if (user.role === Role.ADMIN) {
      return {
        canView: true,
        canEdit: true,
        isCurrent: true,
        isHistorical: false,
        customerId: followUp.customerId,
        status: followUp.status,
      };
    }

    const [scope, activeCustomerAssignment, scheduleGrant] = await Promise.all([
      this.getPartnerCaregiverScope(user.id),
      prisma.customerAssignment.findUnique({
        where: {
          customerId_userId: {
            customerId: followUp.customerId,
            userId: user.id,
          },
        },
      }),
      prisma.customerAssignmentGrant.findUnique({
        where: {
          customer_user_source_unique: {
            customerId: followUp.customerId,
            userId: user.id,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: followUp.id,
          },
        },
      }),
    ]);

    const isDirectOwnerById = followUp.assignedToUserId === user.id;
    const isDirectOwnerByAlias =
      !followUp.assignedToUserId &&
      Boolean(followUp.assignedTo?.trim()) &&
      scope.aliases.some(
        (alias) => alias.toLowerCase() === followUp.assignedTo!.trim().toLowerCase()
      );
    const isCurrentlyAssignedCaregiver = isDirectOwnerById || isDirectOwnerByAlias;

    const hasActiveCustomerAccess =
      Boolean(activeCustomerAssignment) || Boolean(scheduleGrant?.active);

    // Currently assigned schedule: caregiver is this partner AND partner still holds active assignment/grant
    if (isCurrentlyAssignedCaregiver && hasActiveCustomerAccess) {
      const canEdit =
        followUp.status !== FollowUpStatus.COMPLETED &&
        followUp.status !== FollowUpStatus.CANCELLED;
      return {
        canView: true,
        canEdit,
        isCurrent: true,
        isHistorical: false,
        customerId: followUp.customerId,
        status: followUp.status,
      };
    }

    // Historical schedule: partner has a CARE_SCHEDULE grant record (active or inactive) OR is recorded as caregiver on a historical schedule
    if (scheduleGrant || isCurrentlyAssignedCaregiver) {
      return {
        canView: true,
        canEdit: false,
        isCurrent: false,
        isHistorical: true,
        customerId: followUp.customerId,
        status: followUp.status,
      };
    }

    return {
      canView: false,
      canEdit: false,
      isCurrent: false,
      isHistorical: false,
      customerId: followUp.customerId,
      status: followUp.status,
    };
  }

  /**
   * Asserts READ access to a care schedule (`FollowUp`).
   */
  async assertFollowUpReadAccess(user: { id: string; role: Role }, followUpId: string) {
    const res = await this.canViewHistoricalSchedule(user, followUpId);
    if (!res.canView) {
      const custAccess = await this.canViewHistoricalCustomer(user, res.customerId);
      if (!custAccess.canView) {
        throw new NotFoundError(`Lịch chăm sóc không tồn tại hoặc bạn không có quyền truy cập.`);
      }
      throw new ForbiddenError('Bạn không có quyền truy cập lịch chăm sóc chỉ được giao cho nhân viên khác.');
    }
    return res;
  }

  /**
   * Asserts EDIT/COMPLETE access to a care schedule (`FollowUp`).
   * Partner can ONLY edit/complete schedules CURRENTLY assigned to them.
   * Historical/transferred schedules throw 403 Forbidden.
   */
  async canEditCurrentlyAssignedSchedule(
    user: { id: string; role: Role },
    followUpId: string
  ): Promise<string> {
    const res = await this.canViewHistoricalSchedule(user, followUpId);

    if (!res.canView) {
      const custAccess = await this.canViewHistoricalCustomer(user, res.customerId);
      if (!custAccess.canView) {
        throw new NotFoundError(`Lịch chăm sóc không tồn tại hoặc bạn không có quyền truy cập.`);
      }
      throw new ForbiddenError(
        'Bạn không có quyền truy cập hoặc cập nhật lịch chăm sóc được giao cho nhân viên khác.'
      );
    }

    if (user.role === Role.PARTNER && !res.isCurrent) {
      throw new ForbiddenError(
        'Lịch chăm sóc này đã được chuyển giao hoặc kết thúc phân công. Bạn chỉ có quyền xem lịch sử và không được chỉnh sửa hoặc hoàn thành.'
      );
    }

    return res.customerId;
  }

  /**
   * Asserts mutating access to a follow-up (delegates to canEditCurrentlyAssignedSchedule).
   */
  async assertFollowUpAccess(user: { id: string; role: Role }, followUpId: string): Promise<string> {
    return this.canEditCurrentlyAssignedSchedule(user, followUpId);
  }

  /**
   * Asserts write access to a case by looking up its customer.
   */
  async assertCaseAccess(user: { id: string; role: Role }, caseId: string): Promise<string> {
    const customerCase = await prisma.customerCase.findUnique({
      where: { id: caseId },
      select: { customerId: true },
    });

    if (!customerCase) {
      throw new NotFoundError(`Hồ sơ vay không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerWriteAccess(user, customerCase.customerId);
    return customerCase.customerId;
  }

  /**
   * Asserts write access to a need by looking up its customer.
   */
  async assertNeedAccess(user: { id: string; role: Role }, needId: string): Promise<string> {
    const need = await prisma.customerNeed.findUnique({
      where: { id: needId },
      select: { customerId: true },
    });

    if (!need) {
      throw new NotFoundError(`Nhu cầu không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerWriteAccess(user, need.customerId);
    return need.customerId;
  }

  /**
   * Asserts write access to a note by looking up its customer.
   */
  async assertNoteAccess(user: { id: string; role: Role }, noteId: string): Promise<string> {
    const note = await prisma.customerNote.findUnique({
      where: { id: noteId },
      select: { customerId: true },
    });

    if (!note) {
      throw new NotFoundError(`Ghi chú không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerWriteAccess(user, note.customerId);
    return note.customerId;
  }

  /**
   * Asserts write access to a push record by looking up its customer.
   */
  async assertPushRecordAccess(user: { id: string; role: Role }, pushRecordId: string): Promise<string> {
    const pushRecord = await prisma.pushRecord.findUnique({
      where: { id: pushRecordId },
      select: { customerId: true },
    });

    if (!pushRecord) {
      throw new NotFoundError(`Bản ghi chuyển tiếp không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerWriteAccess(user, pushRecord.customerId);
    return pushRecord.customerId;
  }

  /**
   * Asserts write access to a recommendation by looking up its customer.
   */
  async assertRecommendationAccess(user: { id: string; role: Role }, recommendationId: string): Promise<string> {
    const rec = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      select: { customerId: true },
    });

    if (!rec) {
      throw new NotFoundError(`Gợi ý không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerWriteAccess(user, rec.customerId);
    return rec.customerId;
  }

  /**
   * Scopes customer query filter for repository lists.
   * Supports `assignmentScope`: 'all' (default: current + historical), 'current' (only currently assigned), 'historical' (only historical).
   */
  async scopeCustomerIdsFilter(
    user: { id: string; role: Role },
    assignmentScope: AssignmentScopeFilter = 'all'
  ): Promise<string[] | null> {
    if (user.role === Role.ADMIN) {
      return null; // Null indicates unrestricted access
    }
    const scope = await this.getPartnerCustomerScope(user.id);
    let targetIds: string[];
    if (assignmentScope === 'current') {
      targetIds = scope.currentIds;
    } else if (assignmentScope === 'historical') {
      targetIds = scope.historicalIds;
    } else {
      targetIds = scope.allIds;
    }
    return targetIds.length > 0 ? targetIds : ['__none__'];
  }
}

export const customerAccessService = new CustomerAccessService();
export default customerAccessService;
