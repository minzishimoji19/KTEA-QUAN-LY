import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { Role, UserStatus } from '@prisma/client';
import {
  UnauthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '../utils/errors.js';
import { auditLogService } from './auditLog.service.js';

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
  async listUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedCustomers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
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

    // Upsert assignments
    await prisma.$transaction(
      uniqueCustomerIds.map((customerId) =>
        prisma.customerAssignment.upsert({
          where: {
            customerId_userId: {
              customerId,
              userId: partnerUserId,
            },
          },
          create: {
            customerId,
            userId: partnerUserId,
            assignedById: actor.id,
            notes: notes || null,
          },
          update: {
            assignedById: actor.id,
            notes: notes || undefined,
            assignedAt: new Date(),
          },
        })
      )
    );

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
   * ADMIN only: Remove customer assignment from a partner.
   */
  async unassignCustomer(
    actor: { id: string; email: string },
    partnerUserId: string,
    customerId: string
  ) {
    const assignment = await prisma.customerAssignment.findUnique({
      where: {
        customerId_userId: {
          customerId,
          userId: partnerUserId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundError('Khách hàng này chưa được phân công cho nhân viên');
    }

    await prisma.customerAssignment.delete({
      where: {
        customerId_userId: {
          customerId,
          userId: partnerUserId,
        },
      },
    });

    await auditLogService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'UNASSIGN_CUSTOMER',
      entityType: 'CustomerAssignment',
      entityId: partnerUserId,
      details: { customerId, partnerId: partnerUserId },
    });

    return { success: true };
  }

  /**
   * Retrieves assignments for a specific user.
   * ADMIN can view assignments for any user.
   * PARTNER can only view their own assignments.
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

    return assignments;
  }
}

export const userService = new UserService();
export default userService;
