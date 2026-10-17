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
   * Asserts access to a follow-up by looking up its customer.
   */
  async assertFollowUpAccess(user: { id: string; role: Role }, followUpId: string): Promise<string> {
    const followUp = await prisma.followUp.findUnique({
      where: { id: followUpId },
      select: { customerId: true },
    });

    if (!followUp) {
      throw new NotFoundError(`Lịch chăm sóc không tồn tại hoặc bạn không có quyền truy cập.`);
    }

    await this.assertCustomerAccess(user, followUp.customerId);
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
