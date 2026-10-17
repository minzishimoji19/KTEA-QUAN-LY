import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { Role, UserStatus, FollowUpStatus } from '@prisma/client';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../utils/errors.js';
import { auditLogService } from './auditLog.service.js';
import { assignmentSyncService } from './assignmentSync.service.js';

export class UserService {
  /**
   * Authenticates user with email and password.
   */
  async authenticate(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Tài khoản đã bị tạm khóa hoặc ngừng hoạt động');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Email hoặc mật khẩu không chính xác');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
  }

  /**
   * Bootstrap the initial Admin account safely (idempotent, no-op if admin exists).
   */
  async bootstrapFirstAdmin(data: { email: string; password: string; fullName?: string }) {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
    });

    if (existingAdmin) {
      return {
        created: false,
        message: 'Admin account already exists.',
        user: {
          id: existingAdmin.id,
          email: existingAdmin.email,
          fullName: existingAdmin.fullName,
          role: existingAdmin.role,
        },
      };
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(data.password, 12);

    const admin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: data.fullName || 'Hệ Thống Admin',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    await auditLogService.log({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'BOOTSTRAP_ADMIN',
      entityType: 'User',
      entityId: admin.id,
      details: { email: admin.email, role: admin.role },
    });

    return {
      created: true,
      message: 'Initial Admin account created successfully.',
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
    };
  }

  /**
   * ADMIN only: List all accounts with assignment counts.
   */
  /**
   * ADMIN only: List all accounts with assignment counts and linked caregiver details.
   */
  async listUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        caretaker: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
        _count: {
          select: {
            assignedCustomers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      ...u,
      assignedCustomersCount: u._count?.assignedCustomers ?? 0,
    }));
  }

  /**
   * ADMIN only: Create new user account.
   */
  async createUser(
    creator: { id: string; email: string },
    data: {
      email: string;
      password: string;
      fullName: string;
      role: Role;
      phone?: string;
    }
  ) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictError(`Email '${normalizedEmail}' đã được đăng ký tài khoản`);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: data.fullName.trim(),
        role: data.role,
        status: UserStatus.ACTIVE,
        phone: data.phone?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
      },
    });

    await auditLogService.log({
      actorId: creator.id,
      actorEmail: creator.email,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: newUser.id,
      details: { email: newUser.email, role: newUser.role, fullName: newUser.fullName },
    });

    return newUser;
  }

  /**
   * ADMIN only: Update an existing account (status, role, name, reset password).
   */
  async updateUser(
    actor: { id: string; email: string },
    targetUserId: string,
    data: {
      fullName?: string;
      role?: Role;
      status?: UserStatus;
      phone?: string | null;
      password?: string;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundError('Tài khoản người dùng không tồn tại');
    }

    // Protect against self-demotion if only 1 active admin
    if (data.role && data.role !== Role.ADMIN && user.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE },
      });
      if (adminCount <= 1) {
        throw new ForbiddenError('Không thể hạ quyền Admin duy nhất trong hệ thống');
      }
    }

    let passwordHash: string | undefined = undefined;
    if (data.password && data.password.trim()) {
      if (data.password.length < 8) {
        throw new BadRequestError('Mật khẩu mới phải có tối thiểu 8 ký tự');
      }
      passwordHash = await bcrypt.hash(data.password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        updatedAt: true,
      },
    });

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: targetUserId,
      details: {
        updatedFields: Object.keys(data).filter((k) => k !== 'password'),
        roleChangedTo: data.role,
        statusChangedTo: data.status,
      },
    });

    return updated;
  }

  /**
   * ADMIN only: Assign customers to a partner.
   */
  async assignCustomers(
    actor: { id: string; email: string },
    partnerUserId: string,
    customerIds: string[],
    notes?: string
  ) {
    const partner = await prisma.user.findUnique({
      where: { id: partnerUserId },
    });

    if (!partner) {
      throw new NotFoundError('Đối tác / Nhân viên được chọn không tồn tại');
    }

    if (partner.status !== UserStatus.ACTIVE) {
      throw new BadRequestError('Không thể phân công khách hàng cho tài khoản đang bị khóa');
    }

    // Verify all customer IDs exist
    const uniqueCustomerIds = Array.from(new Set(customerIds));
    const count = await prisma.customer.count({
      where: { id: { in: uniqueCustomerIds } },
    });

    if (count !== uniqueCustomerIds.length) {
      throw new NotFoundError('Một số khách hàng trong danh sách không tồn tại');
    }

    // Upsert assignments and record DIRECT grants sequentially to prevent driver contention
    await prisma.$transaction(async (tx) => {
      for (const customerId of uniqueCustomerIds) {
        await assignmentSyncService.recordDirectAssignment(tx, {
          customerId,
          userId: partnerUserId,
          assignedById: actor.id,
          notes,
        });
      }
    },
    {
      maxWait: 5000,
      timeout: 15000,
    });

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'ASSIGN_CUSTOMERS',
      entityType: 'CustomerAssignment',
      entityId: partnerUserId,
      details: {
        partnerId: partnerUserId,
        partnerName: partner.fullName,
        customerCount: uniqueCustomerIds.length,
        customerIds: uniqueCustomerIds,
        source: 'DIRECT',
      },
    });

    return {
      success: true,
      affected: uniqueCustomerIds.length,
      partner: {
        id: partner.id,
        fullName: partner.fullName,
        email: partner.email,
      },
    };
  }

  /**
   * ADMIN only: Remove direct customer assignment from a partner.
   * If the partner still has other valid sources (e.g. active care schedules), access is preserved.
   */
  async unassignCustomer(
    actor: { id: string; email: string },
    partnerUserId: string,
    customerId: string,
    options?: {
      sourceType?: 'DIRECT' | 'CARE_SCHEDULE' | 'ALL';
      sourceId?: string;
    }
  ) {
    const existingAssignment = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId: partnerUserId,
        },
      },
    });

    const existingGrants = await prisma.customerAssignmentGrant.findMany({
      where: {
        customerId,
        userId: partnerUserId,
        active: true,
      },
    });

    // Idempotent: if neither assignment nor grants exist, request is already satisfied
    if (!existingAssignment && existingGrants.length === 0) {
      return {
        success: true,
        completelyRevoked: true,
        remainingSourcesCount: 0,
        message: 'Khách hàng này hiện không còn phân công cho nhân viên.',
      };
    }

    const hasDirectGrant = existingGrants.some((g) => g.sourceType === 'DIRECT');
    const hasCareScheduleGrant = existingGrants.some((g) => g.sourceType === 'CARE_SCHEDULE');

    // Determine target source:
    // If not explicitly provided, smart-detect:
    // - If partner only has CARE_SCHEDULE (e.g. from follow-up/backfill), revoke CARE_SCHEDULE!
    // - If partner has DIRECT (or both), revoke DIRECT (preserving care schedule unless ALL requested)
    let targetSourceType = options?.sourceType;
    if (!targetSourceType) {
      if (!hasDirectGrant && hasCareScheduleGrant) {
        targetSourceType = 'CARE_SCHEDULE';
      } else {
        targetSourceType = 'DIRECT';
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (targetSourceType === 'ALL') {
        return assignmentSyncService.revokeAllAssignments(tx, {
          customerId,
          userId: partnerUserId,
        });
      } else if (targetSourceType === 'CARE_SCHEDULE') {
        return assignmentSyncService.revokeCareScheduleAssignment(tx, {
          customerId,
          userId: partnerUserId,
          followUpId: options?.sourceId,
        });
      } else {
        // DIRECT (or legacy assignment with no grants)
        const res = await assignmentSyncService.revokeDirectAssignment(tx, {
          customerId,
          userId: partnerUserId,
        });

        // If legacy assignment had no grants at all, revokeDirectAssignment deletes assignment if count === 0
        if (!hasDirectGrant && !hasCareScheduleGrant) {
          await tx.customerAssignment.deleteMany({
            where: { customerId, userId: partnerUserId },
          });
          return { completelyRevoked: true, remainingSourcesCount: 0 };
        }
        return res;
      }
    },
    {
      maxWait: 5000,
      timeout: 15000,
    });

    let message: string;
    if (result.completelyRevoked) {
      message = 'Đã thu hồi toàn bộ quyền phụ trách khách hàng.';
    } else if (targetSourceType === 'DIRECT') {
      message = `Đã thu hồi nguồn phân công trực tiếp. Nhân viên vẫn giữ quyền phụ trách do còn ${result.remainingSourcesCount} lịch chăm sóc hợp lệ.`;
    } else {
      message = `Đã gỡ quyền phụ trách từ lịch chăm sóc. Nhân viên vẫn giữ quyền phụ trách do còn phân công trực tiếp.`;
    }

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UNASSIGN_CUSTOMER',
      entityType: 'CustomerAssignment',
      entityId: partnerUserId,
      details: {
        customerId,
        partnerId: partnerUserId,
        sourceType: targetSourceType,
        completelyRevoked: result.completelyRevoked,
        remainingSourcesCount: result.remainingSourcesCount,
      },
    });

    return {
      success: true,
      completelyRevoked: result.completelyRevoked,
      remainingSourcesCount: result.remainingSourcesCount,
      revokedSource: targetSourceType,
      message,
    };
  }

  /**
   * Bulk unassign customers from a partner (ADMIN only).
   */
  async bulkUnassignCustomers(
    actor: { id: string; email: string; role: Role },
    data: {
      partnerUserId: string;
      customerIds: string[];
      sourceType?: 'DIRECT' | 'CARE_SCHEDULE' | 'ALL';
    }
  ) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenError('Chỉ Quản trị viên (ADMIN) mới có quyền hủy phân công hàng loạt.');
    }

    const { partnerUserId, customerIds, sourceType = 'ALL' } = data;
    if (!partnerUserId) {
      throw new BadRequestError('partnerUserId là bắt buộc.');
    }
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      throw new BadRequestError('Danh sách khách hàng customerIds không được để trống.');
    }

    const uniqueIds = Array.from(new Set(customerIds.filter(Boolean)));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const customerId of uniqueIds) {
      try {
        await this.unassignCustomer(
          actor,
          partnerUserId,
          customerId,
          { sourceType }
        );
        succeeded.push(customerId);
      } catch (err: any) {
        failed.push({
          id: customerId,
          reason: err.message || 'Lỗi khi hủy phân công',
        });
      }
    }

    const message =
      failed.length === 0
        ? `Đã hủy phân công thành công ${succeeded.length} khách hàng.`
        : succeeded.length > 0
        ? `Đã hủy phân công ${succeeded.length}/${uniqueIds.length} khách hàng. (${failed.length} thất bại)`
        : `Không thể hủy phân công các khách hàng đã chọn.`;

    return {
      success: succeeded.length > 0,
      total: uniqueIds.length,
      succeeded,
      failed,
      message,
    };
  }

  /**
   * Bulk reassign customers to a new caregiver/partner (ADMIN only).
   */
  async bulkReassignCustomers(
    actor: { id: string; email: string; role: Role },
    data: {
      fromUserId?: string;
      toUserId: string;
      customerIds: string[];
      notes?: string;
    }
  ) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenError('Chỉ Quản trị viên (ADMIN) mới có quyền đổi người chăm sóc hàng loạt.');
    }

    const { fromUserId, toUserId, customerIds, notes } = data;
    if (!toUserId) {
      throw new BadRequestError('toUserId (người nhận phân công) là bắt buộc.');
    }
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      throw new BadRequestError('Danh sách khách hàng customerIds không được để trống.');
    }

    // Target user must be an active User
    const targetUser = await prisma.user.findUnique({
      where: { id: toUserId },
    });
    if (!targetUser) {
      throw new NotFoundError('Tài khoản người nhận phân công không tồn tại.');
    }
    if (targetUser.status !== UserStatus.ACTIVE) {
      throw new BadRequestError(`Tài khoản "${targetUser.fullName}" đang ở trạng thái ${targetUser.status}, không thể nhận phân công.`);
    }

    const uniqueIds = Array.from(new Set(customerIds.filter(Boolean)));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    const existingCustomers = await prisma.customer.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, fullName: true },
    });
    const foundIds = new Set(existingCustomers.map((c) => c.id));

    for (const customerId of uniqueIds) {
      if (!foundIds.has(customerId)) {
        failed.push({ id: customerId, reason: 'Khách hàng không tồn tại trong hệ thống.' });
        continue;
      }

      try {
        await prisma.$transaction(
          async (tx) => {
            // 1. Reassign any pending/in-progress care tasks for this customer to toUserId first
            const followUpsToTransfer = await tx.followUp.findMany({
              where: {
                customerId,
                status: { in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS] },
                ...(fromUserId ? { assignedToUserId: fromUserId } : {}),
              },
            });

            for (const fu of followUpsToTransfer) {
              await tx.followUp.update({
                where: { id: fu.id },
                data: {
                  assignedToUserId: toUserId,
                  assignedTo: targetUser.fullName,
                },
              });

              await assignmentSyncService.syncFollowUpAssignment(tx, {
                followUpId: fu.id,
                customerId,
                caregiverUserId: toUserId,
                assignedById: actor.id,
              });
            }

            // 2. If fromUserId provided, unassign customer and any lingering grants from fromUserId
            if (fromUserId && fromUserId !== toUserId) {
              await assignmentSyncService.revokeAllAssignments(tx, {
                customerId,
                userId: fromUserId,
              });
            }

            // 3. Assign to target user directly
            await assignmentSyncService.recordDirectAssignment(tx, {
              customerId,
              userId: toUserId,
              assignedById: actor.id,
              notes: notes || (fromUserId ? 'Chuyển giao hàng loạt từ quản trị viên' : 'Phân công hàng loạt từ quản trị viên'),
            });
          },
          { maxWait: 5000, timeout: 15000 }
        );

        succeeded.push(customerId);
      } catch (err: any) {
        failed.push({
          id: customerId,
          reason: err.message || 'Lỗi khi chuyển giao khách hàng',
        });
      }
    }

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'BULK_REASSIGN_CUSTOMERS',
      entityType: 'CustomerAssignment',
      entityId: toUserId,
      details: {
        fromUserId: fromUserId || null,
        toUserId,
        totalRequested: uniqueIds.length,
        succeededCount: succeeded.length,
        failedCount: failed.length,
      },
    });

    const message =
      failed.length === 0
        ? `Đã chuyển đổi người chăm sóc cho ${succeeded.length} khách hàng sang "${targetUser.fullName}".`
        : succeeded.length > 0
        ? `Đã chuyển đổi ${succeeded.length}/${uniqueIds.length} khách hàng sang "${targetUser.fullName}". (${failed.length} thất bại)`
        : `Không thể chuyển đổi người chăm sóc cho các khách hàng đã chọn.`;

    return {
      success: succeeded.length > 0,
      total: uniqueIds.length,
      succeeded,
      failed,
      message,
    };
  }

  /**
   * Retrieves assignments for a specific user.
   * ADMIN can view assignments for any user.
   * PARTNER can only view their own assignments.
   * Enriches each assignment with detailed source breakdown (DIRECT, CARE_SCHEDULE).
   */
  async getUserAssignments(
    actor: { id: string; role: Role },
    targetUserId: string
  ) {
    if (actor.role !== Role.ADMIN && actor.id !== targetUserId) {
      throw new ForbiddenError('Bạn chỉ có quyền xem danh sách phân công của chính mình');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, email: true, role: true },
    });

    if (!targetUser) {
      throw new NotFoundError('Tài khoản người dùng không tồn tại');
    }

    const assignments = await prisma.customerAssignment.findMany({
      where: { userId: targetUserId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            overallStatus: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    const customerIds = assignments.map((a) => a.customerId);

    // Fetch active grants for this user
    const grants = await prisma.customerAssignmentGrant.findMany({
      where: {
        userId: targetUserId,
        active: true,
      },
      select: {
        id: true,
        customerId: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });

    // Fetch active follow-ups for this user across these customers
    const followUps = await prisma.followUp.findMany({
      where: {
        customerId: { in: customerIds },
        assignedToUserId: targetUserId,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        customerId: true,
        title: true,
        dueAt: true,
        status: true,
      },
      orderBy: { dueAt: 'asc' },
    });

    return assignments.map((a) => {
      const userGrants = grants.filter((g) => g.customerId === a.customerId);
      const userFollowUps = followUps.filter((f) => f.customerId === a.customerId);
      const hasDirect = userGrants.some((g) => g.sourceType === 'DIRECT');
      const hasCareSchedule = userGrants.some((g) => g.sourceType === 'CARE_SCHEDULE') || userFollowUps.length > 0;
      const isLegacyDirect = userGrants.length === 0;

      return {
        ...a,
        sources: {
          hasDirect: hasDirect || isLegacyDirect,
          hasCareSchedule,
          isLegacyDirect,
          careSchedulesCount: userFollowUps.length,
          careSchedules: userFollowUps,
          grantCount: userGrants.length,
        },
      };
    });
  }

  /**
   * Retrieves active users eligible to be assigned as caregivers.
   * Every active user (PARTNER and ADMIN) is directly eligible as caregiver.
   */
  async getEligibleCaregivers() {
    return prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
      },
      orderBy: [
        { role: 'asc' },
        { fullName: 'asc' },
      ],
    });
  }
}

export const userService = new UserService();
export default userService;
