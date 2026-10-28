import prisma from '../config/database.js';
import { Role } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export interface UserContext {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export class CustomerAccessService {
  /**
   * Retrieves all customer IDs assigned to a specific user.
   */
  async getAssignedCustomerIds(userId: string): Promise<string[]> {
    const assignments = await prisma.customerAssignment.findMany({
      where: { userId },
      select: { customerId: true },
    });
    return assignments.map((a) => a.customerId);
  }

  /**
   * Checks if user has access to a specific customer.
   * Admins have universal access; Partners only have access if assigned.
   */
  async canAccessCustomer(user: { id: string; role: Role }, customerId: string): Promise<boolean> {
    if (user.role === Role.ADMIN) {
      return true;
    }

    const assignment = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId: user.id,
        },
      },
    });

    return Boolean(assignment);
  }

  /**
   * Asserts access to customer. Throws NotFoundError (404) to prevent enumeration of out-of-scope customers.
   */
  async assertCustomerAccess(user: { id: string; role: Role }, customerId: string): Promise<void> {
    const hasAccess = await this.canAccessCustomer(user, customerId);
    if (!hasAccess) {
      throw new NotFoundError(`Khách hàng không tồn tại hoặc bạn không có quyền truy cập.`);
    }
  }

  /**
   * Asserts access to a case by looking up its customer.
   */
  async assertCaseAccess(user: { id: string; role: Role }, caseId: string): Promise<string> {
    const customerCase = await prisma.customerCase.findUnique({
      where: { id: caseId },
      select: { customerId: true },
    });

    if (!customerCase) {
      throw new NotFoundError(`Hồ sơ vay không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerAccess(user, customerCase.customerId);
    return customerCase.customerId;
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
   * Asserts access to a follow-up by looking up its customer AND verifying schedule-level ownership for Partners.
   */
  async assertFollowUpAccess(user: { id: string; role: Role }, followUpId: string): Promise<string> {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      select: {
        id: true,
        customerId: true,
        assignedToUserId: true,
        assignedTo: true,
      },
    });

    if (!followUp) {
      throw new NotFoundError(`Lịch chăm sóc không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    // 1. Check customer-level access first (throws 404 if Partner is not assigned to the customer)
    await this.assertCustomerAccess(user, followUp.customerId);

    // 2. For PARTNER, enforce schedule-level ownership so Partner A cannot access/mutate Partner B's schedule on a shared customer
    if (user.role === Role.PARTNER) {
      if (followUp.assignedToUserId && followUp.assignedToUserId !== user.id) {
        throw new ForbiddenError('Bạn không có quyền truy cập hoặc cập nhật lịch chăm sóc được giao cho nhân viên khác.');
      }

      if (!followUp.assignedToUserId && followUp.assignedTo && followUp.assignedTo.trim()) {
        const scope = await this.getPartnerCaregiverScope(user.id);
        const targetLower = followUp.assignedTo.trim().toLowerCase();
        const isMatchedAlias = scope.aliases.some((alias) => alias.toLowerCase() === targetLower);
        if (!isMatchedAlias) {
          throw new ForbiddenError('Bạn không có quyền truy cập hoặc cập nhật lịch chăm sóc được giao cho nhân viên khác.');
        }
      }
    }

    return followUp.customerId;
  }

  /**
   * Asserts access to a need by looking up its customer.
   */
  async assertNeedAccess(user: { id: string; role: Role }, needId: string): Promise<string> {
    const need = await prisma.customerNeed.findUnique({
      where: { id: needId },
      select: { customerId: true },
    });

    if (!need) {
      throw new NotFoundError(`Nhu cầu không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerAccess(user, need.customerId);
    return need.customerId;
  }

  /**
   * Asserts access to a note by looking up its customer.
   */
  async assertNoteAccess(user: { id: string; role: Role }, noteId: string): Promise<string> {
    const note = await prisma.customerNote.findUnique({
      where: { id: noteId },
      select: { customerId: true },
    });

    if (!note) {
      throw new NotFoundError(`Ghi chú không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerAccess(user, note.customerId);
    return note.customerId;
  }

  /**
   * Asserts access to a push record by looking up its customer.
   */
  async assertPushRecordAccess(user: { id: string; role: Role }, pushRecordId: string): Promise<string> {
    const pushRecord = await prisma.pushRecord.findUnique({
      where: { id: pushRecordId },
      select: { customerId: true },
    });

    if (!pushRecord) {
      throw new NotFoundError(`Bản ghi chuyển tiếp không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerAccess(user, pushRecord.customerId);
    return pushRecord.customerId;
  }

  /**
   * Asserts access to a recommendation by looking up its customer.
   */
  async assertRecommendationAccess(user: { id: string; role: Role }, recommendationId: string): Promise<string> {
    const rec = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      select: { customerId: true },
    });

    if (!rec) {
      throw new NotFoundError(`Gợi ý không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerAccess(user, rec.customerId);
    return rec.customerId;
  }

  /**
   * Scopes customer query filter for repository lists.
   */
  async scopeCustomerIdsFilter(user: { id: string; role: Role }): Promise<string[] | null> {
    if (user.role === Role.ADMIN) {
      return null; // Null indicates unrestricted access
    }
    const assignedIds = await this.getAssignedCustomerIds(user.id);
    return assignedIds.length > 0 ? assignedIds : ['__none__'];
  }
}

export const customerAccessService = new CustomerAccessService();
export default customerAccessService;
