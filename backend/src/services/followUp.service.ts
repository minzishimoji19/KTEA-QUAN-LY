import { FollowUpStatus, ActivityType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { followUpRepository } from '../repositories/followUp.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { caretakerRepository } from '../repositories/caretaker.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';
import { pushNotificationService } from './pushNotification.service.js';
import { assignmentSyncService } from './assignmentSync.service.js';

export class FollowUpService extends BaseService {
  /**
   * Validates assigned caregiver against active Users first, with fallback to legacy Caretakers catalog.
   * Returns { userId, name } where userId is non-null for system users, and null for legacy unmapped caretakers.
   */
  async validateAssignedTo(
    identifier?: string | null,
    allowInactiveIfCurrentSame?: string | null
  ): Promise<{ userId: string | null; name: string } | null> {
    if (!identifier || typeof identifier !== 'string') {
      return null;
    }
    const trimmed = identifier.trim();
    if (!trimmed) {
      return null;
    }

    // 1. Check direct User by ID (UUID)
    const userById = await prisma.user.findUnique({
      where: { id: trimmed },
    });
    if (userById) {
      if (userById.status !== 'ACTIVE') {
        const isSame =
          allowInactiveIfCurrentSame &&
          (allowInactiveIfCurrentSame === userById.fullName || allowInactiveIfCurrentSame === userById.id);
        if (!isSame) {
          throw new BadRequestError(
            `Tài khoản nhân viên '${userById.fullName}' đang bị tạm khóa hoặc ngừng hoạt động và không thể nhận lịch chăm sóc mới.`
          );
        }
      }
      return { userId: userById.id, name: userById.fullName };
    }

    // 2. Check direct User by full name
    const userByName = await prisma.user.findFirst({
      where: { fullName: trimmed },
    });
    if (userByName) {
      if (userByName.status !== 'ACTIVE') {
        const isSame =
          allowInactiveIfCurrentSame &&
          (allowInactiveIfCurrentSame === userByName.fullName || allowInactiveIfCurrentSame === userByName.id);
        if (!isSame) {
          throw new BadRequestError(
            `Tài khoản nhân viên '${userByName.fullName}' đang bị tạm khóa hoặc ngừng hoạt động và không thể nhận lịch chăm sóc mới.`
          );
        }
      }
      return { userId: userByName.id, name: userByName.fullName };
    }

    // 3. Fallback to legacy caretaker table (for historical unmapped records like 'mfast')
    let caretaker = await caretakerRepository.findById(trimmed);
    if (!caretaker) {
      caretaker = await caretakerRepository.findByName(trimmed);
    }
    if (!caretaker) {
      caretaker = await caretakerRepository.findByUserId(trimmed);
    }

    if (caretaker) {
      if (caretaker.userId && caretaker.user) {
        if (caretaker.user.status !== 'ACTIVE') {
          throw new BadRequestError(`Tài khoản nhân viên '${caretaker.user.fullName}' đang bị tạm khóa hoặc ngừng hoạt động.`);
        }
        return { userId: caretaker.userId, name: caretaker.user.fullName };
      }
      if (!caretaker.active) {
        const isSame =
          allowInactiveIfCurrentSame &&
          (allowInactiveIfCurrentSame.toLowerCase() === caretaker.name.toLowerCase() ||
            allowInactiveIfCurrentSame === caretaker.id);
        if (!isSame) {
          throw new BadRequestError(`Người chăm sóc '${caretaker.name}' đã ngừng hoạt động và không thể phân công mới.`);
        }
      }
      return { userId: null, name: caretaker.name };
    }

    throw new BadRequestError(`Nhân viên chăm sóc '${trimmed}' không tồn tại trong hệ thống.`);
  }

  async getFollowUps(
    filter?: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all',
    status?: FollowUpStatus,
    customerId?: string,
    assignedTo?: string,
    scopedCustomerIds?: string[]
  ) {
    if (customerId) {
      const customer = await customerRepository.findById(customerId);
      if (!customer) {
        throw new NotFoundError(`Customer with ID '${customerId}' not found`);
      }
    }
    return followUpRepository.findAll(filter, status, customerId, assignedTo, scopedCustomerIds);
  }

  async getFollowUpById(id: string) {
    const followUp = await followUpRepository.findById(id);
    if (!followUp) {
      throw new NotFoundError(`Follow-up with ID '${id}' not found`);
    }
    return followUp;
  }

  /**
   * Dispatches follow-up notifications asynchronously outside database transactions.
   * Ensures notification failures never fail the scheduling or roll back data.
   */
  async dispatchNotifications(
    followUps: Array<{ id: string; customerId: string; title: string; dueAt: Date | string; assignedTo?: string | null; description?: string | null; customer?: any }>
  ): Promise<void> {
    try {
      await pushNotificationService.notifyNewFollowUps(followUps);
    } catch (err) {
      console.warn('[Notification] Failed to dispatch follow-up notifications (non-blocking):', err);
    }
  }

  async createFollowUp(data: {
    customerId: string;
    title: string;
    description?: string | null;
    dueAt: string | Date;
    status?: FollowUpStatus;
    assignedTo?: string | null;
    assignedToUserId?: string | null;
  }) {
    const customer = await customerRepository.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${data.customerId}' not found`);
    }

    const dueDate = new Date(data.dueAt);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestError('Ngày giờ hẹn không hợp lệ');
    }

    const followUpStatus = data.status || FollowUpStatus.PENDING;
    const resolvedCaregiver = await this.validateAssignedTo(data.assignedToUserId || data.assignedTo);
    const caretaker = resolvedCaregiver?.name || null;
    const assignedUserId = resolvedCaregiver?.userId || null;
    const desc = data.description !== undefined ? data.description : null;
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const followUp = await prisma.$transaction(
      async (tx) => {
        // Prevent duplicate creation on immediate retry/double click
        const existing = await tx.followUp.findFirst({
          where: {
            customerId: data.customerId,
            title: data.title,
            dueAt: dueDate,
            status: followUpStatus,
            assignedTo: caretaker,
            assignedToUserId: assignedUserId,
          },
          include: {
            customer: {
              select: { id: true, fullName: true, phone: true },
            },
            assignedToUser: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        });

        if (existing) {
          return existing;
        }

        const created = await tx.followUp.create({
          data: {
            customerId: data.customerId,
            title: data.title,
            description: desc,
            dueAt: dueDate,
            status: followUpStatus,
            assignedTo: caretaker,
            assignedToUserId: assignedUserId,
          },
          include: {
            customer: {
              select: { id: true, fullName: true, phone: true },
            },
            assignedToUser: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        });

        // Synchronize customer assignment grant if caregiver is linked to an active partner
        const syncResult = await assignmentSyncService.syncFollowUpAssignment(tx, {
          followUpId: created.id,
          customerId: data.customerId,
          caregiverUserId: assignedUserId,
          caregiverName: caretaker,
          assignedById: (data as any).assignedById || null,
        });

        await tx.customerActivity.create({
          data: {
            customerId: data.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Follow-up Scheduled: ${data.title}`,
            description: `Due date set for ${dueDateStr}${caretaker ? ` | Người chăm sóc: ${caretaker}` : ''}. ${syncResult.notice}`,
          },
        });

        return Object.assign(created, { syncResult });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    // Non-blocking notification dispatch outside transaction
    this.dispatchNotifications([followUp]).catch((err) => {
      console.warn('[Notification] Dispatch error (non-blocking):', err);
    });

    return followUp;
  }

  async createBulkFollowUps(data: {
    customerIds: string[];
    title: string;
    description?: string | null;
    dueAt: string | Date;
    status?: FollowUpStatus;
    assignedTo?: string | null;
    assignedToUserId?: string | null;
  }) {
    const { customerIds, title, description, dueAt, status, assignedTo, assignedToUserId } = data;
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      throw new BadRequestError('Phải chọn ít nhất một khách hàng');
    }

    // Deduplicate customer IDs to prevent duplicate processing within request
    const uniqueCustomerIds = Array.from(
      new Set(customerIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean))
    );

    if (uniqueCustomerIds.length === 0) {
      throw new BadRequestError('Phải chọn ít nhất một khách hàng');
    }

    const customers = await prisma.customer.findMany({
      where: { id: { in: uniqueCustomerIds } },
      select: { id: true, fullName: true, phone: true },
    });

    if (customers.length !== uniqueCustomerIds.length) {
      throw new NotFoundError('Một số khách hàng được chọn không tồn tại trong hệ thống');
    }

    const dueDate = new Date(dueAt);
    if (isNaN(dueDate.getTime())) {
      throw new BadRequestError('Ngày giờ hẹn không hợp lệ');
    }

    const followUpStatus = status || FollowUpStatus.PENDING;
    const resolvedCaregiver = await this.validateAssignedTo(assignedToUserId || assignedTo);
    const caretaker = resolvedCaregiver?.name || null;
    const assignedUserId = resolvedCaregiver?.userId || null;
    const desc = description !== undefined ? description : null;
    const dueDateStr = dueDate.toISOString().split('T')[0];
    const BATCH_SIZE = 250;

    // Pre-resolve partner user outside transaction to minimize queries and duration within the transaction
    let partnerUser: { id: string; fullName: string; email: string } | null = null;
    if (assignedUserId) {
      const user = await prisma.user.findUnique({
        where: { id: assignedUserId },
        select: { id: true, fullName: true, email: true, role: true, status: true },
      });
      if (user && user.status === 'ACTIVE' && user.role === 'PARTNER') {
        partnerUser = { id: user.id, fullName: user.fullName, email: user.email };
      }
    }

    // Sort customer IDs to guarantee consistent row lock ordering and avoid MySQL deadlocks
    const sortedCustomerIds = [...uniqueCustomerIds].sort();

    const result = await prisma.$transaction(
      async (tx) => {
        // Row-level lock on customers in consistent sorted order
        if (sortedCustomerIds.length > 0) {
          await tx.$queryRaw`SELECT id FROM customers WHERE id IN (${Prisma.join(sortedCustomerIds)}) FOR UPDATE`;
        }

        // Check for existing follow-ups with same criteria to prevent duplicate records on retry
        const existingFollowUps = await tx.followUp.findMany({
          where: {
            customerId: { in: uniqueCustomerIds },
            title,
            dueAt: dueDate,
            status: followUpStatus,
            assignedTo: caretaker,
            assignedToUserId: assignedUserId,
          },
          include: {
            customer: {
              select: { id: true, fullName: true, phone: true },
            },
            assignedToUser: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
        });

        const existingCustomerIds = new Set(existingFollowUps.map((f) => f.customerId));
        const customersToCreate = customers.filter((c) => !existingCustomerIds.has(c.id));

        const followUpRecords = customersToCreate.map((customer) => ({
          id: randomUUID(),
          customerId: customer.id,
          title,
          description: desc,
          dueAt: dueDate,
          status: followUpStatus,
          assignedTo: caretaker,
          assignedToUserId: assignedUserId,
        }));

        const activityRecords = customersToCreate.map((customer) => ({
          id: randomUUID(),
          customerId: customer.id,
          type: ActivityType.SYSTEM_EVENT,
          title: `Lên lịch chăm sóc: ${title}`,
          description: `Hạn chăm sóc: ${dueDateStr}${caretaker ? ` | Người chăm sóc: ${caretaker}` : ''}.`,
        }));

        // Batch insert follow-ups
        if (followUpRecords.length > 0) {
          for (let i = 0; i < followUpRecords.length; i += BATCH_SIZE) {
            const batch = followUpRecords.slice(i, i + BATCH_SIZE);
            await tx.followUp.createMany({
              data: batch,
            });
          }
        }

        // Synchronize assignment grants and materialized assignments in bulk (O(1) queries instead of O(N) loops)
        const followUpsToSync = [
          ...followUpRecords.map((r) => ({ followUpId: r.id, customerId: r.customerId })),
          ...existingFollowUps.map((r) => ({ followUpId: r.id, customerId: r.customerId })),
        ];

        if (followUpsToSync.length > 0) {
          await assignmentSyncService.syncBulkFollowUpAssignments(tx, {
            followUps: followUpsToSync,
            caregiverUserId: assignedUserId,
            caregiverName: caretaker,
            assignedById: (data as any).assignedById || null,
            partnerUser,
          });
        }

        // Batch insert customer activities
        if (activityRecords.length > 0) {
          for (let i = 0; i < activityRecords.length; i += BATCH_SIZE) {
            const batch = activityRecords.slice(i, i + BATCH_SIZE);
            await tx.customerActivity.createMany({
              data: batch,
            });
          }
        }

        // Query newly created follow-ups with customer relation to preserve API contract
        const newlyCreatedIds = followUpRecords.map((r) => r.id);
        const newlyCreatedFollowUps =
          newlyCreatedIds.length > 0
            ? await tx.followUp.findMany({
                where: { id: { in: newlyCreatedIds } },
                include: {
                  customer: {
                    select: { id: true, fullName: true, phone: true },
                  },
                  assignedToUser: {
                    select: { id: true, fullName: true, email: true, role: true },
                  },
                },
              })
            : [];

        // Combine existing and newly created records
        const allFollowUps = [...existingFollowUps, ...newlyCreatedFollowUps];

        // Ensure order matches the input customers list
        const customerOrderMap = new Map(customers.map((c, idx) => [c.id, idx]));
        allFollowUps.sort(
          (a, b) => (customerOrderMap.get(a.customerId) ?? 0) - (customerOrderMap.get(b.customerId) ?? 0)
        );

        return {
          count: allFollowUps.length,
          followUps: allFollowUps,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    // Non-blocking notification dispatch outside transaction
    this.dispatchNotifications(result.followUps).catch((err) => {
      console.warn('[Notification] Dispatch error (non-blocking):', err);
    });

    return result;
  }

  async updateFollowUp(id: string, data: {
    title?: string;
    description?: string | null;
    dueAt?: string | Date;
    status?: FollowUpStatus;
    assignedTo?: string | null;
    assignedToUserId?: string | null;
    completedAt?: string | Date | null;
  }) {
    const current = await this.getFollowUpById(id);

    const dueDate = data.dueAt ? new Date(data.dueAt) : undefined;
    let completionDate = data.completedAt !== undefined
      ? (data.completedAt ? new Date(data.completedAt) : null)
      : undefined;

    // Automatically assign completedAt if transitioning to COMPLETED and not provided
    if (data.status === FollowUpStatus.COMPLETED && !current.completedAt && completionDate === undefined) {
      completionDate = new Date();
    } else if (data.status && data.status !== FollowUpStatus.COMPLETED) {
      completionDate = null;
    }

    const hasCaregiverChange = data.assignedTo !== undefined || data.assignedToUserId !== undefined;
    const validatedCaregiver = hasCaregiverChange
      ? await this.validateAssignedTo(data.assignedToUserId !== undefined ? data.assignedToUserId : data.assignedTo, current.assignedTo)
      : undefined;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          dueAt: dueDate,
          status: data.status,
          assignedTo: hasCaregiverChange ? (validatedCaregiver ? validatedCaregiver.name : null) : undefined,
          assignedToUserId: hasCaregiverChange ? (validatedCaregiver ? validatedCaregiver.userId : null) : undefined,
          completedAt: completionDate,
        },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
          assignedToUser: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      });

      // Synchronize assignment grants based on caregiver change or cancellation
      let syncNotice = '';
      if (data.status === FollowUpStatus.CANCELLED) {
        // Lịch bị hủy -> thu hồi nguồn grant của lịch này (không làm mất quyền nếu còn nguồn khác)
        const revokeRes = await assignmentSyncService.revokeFollowUpAssignment(tx, {
          followUpId: id,
          customerId: current.customerId,
        });
        if (revokeRes.revokedUserIds.length > 0) {
          syncNotice = ' Đã thu hồi quyền phụ trách khách hàng do lịch chăm sóc bị hủy.';
        } else if (revokeRes.retainedUserIds.length > 0) {
          syncNotice = ' Nhân viên vẫn giữ quyền phụ trách khách hàng do còn nguồn phân công hợp lệ khác.';
        }
      } else if (
        hasCaregiverChange &&
        ((validatedCaregiver?.name || null) !== current.assignedTo ||
          (current.status === FollowUpStatus.CANCELLED && Boolean(data.status)))
      ) {
        // Đổi caregiver hoặc kích hoạt lại từ CANCELLED
        const syncResult = await assignmentSyncService.syncFollowUpAssignment(tx, {
          followUpId: id,
          customerId: current.customerId,
          caregiverUserId: validatedCaregiver?.userId || null,
          caregiverName: validatedCaregiver?.name || null,
          previousCaregiverName: current.assignedTo,
          assignedById: (data as any).assignedById || null,
        });
        syncNotice = ` ${syncResult.notice}`;
      }

      if (data.status && data.status !== current.status) {
        await tx.customerActivity.create({
          data: {
            customerId: current.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Follow-up ${data.status}: ${current.title}`,
            description: `Status changed from ${current.status} to ${data.status}.${syncNotice}`,
          },
        });
      } else if (syncNotice) {
        await tx.customerActivity.create({
          data: {
            customerId: current.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Đổi người chăm sóc: ${current.title}`,
            description: `Người chăm sóc đổi từ "${current.assignedTo || 'Chưa phân công'}" sang "${validatedCaregiver?.name || 'Chưa phân công'}".${syncNotice}`,
          },
        });
      }

      return updated;
    },
    {
      maxWait: 5000,
      timeout: 15000,
    });
  }

  async deleteFollowUp(id: string) {
    const current = await this.getFollowUpById(id);
    if (current.status === FollowUpStatus.COMPLETED) {
      throw new BadRequestError('Không thể xóa lịch chăm sóc đã hoàn thành vì đây là lịch sử chăm sóc thực tế của khách hàng.');
    }

    return prisma.$transaction(async (tx) => {
      // Safely revoke any assignment grants before hard-deleting the record
      await assignmentSyncService.revokeFollowUpAssignment(tx, {
        followUpId: id,
        customerId: current.customerId,
      });

      return tx.followUp.delete({
        where: { id },
      });
    },
    {
      maxWait: 5000,
      timeout: 15000,
    });
  }

  /**
   * Bulk marks follow-ups as completed with deterministic partial success semantics.
   * Only allows valid PENDING / IN_PROGRESS follow-ups to transition to COMPLETED.
   * Strictly avoids modifying CustomerCase financial states.
   */
  async completeBulkFollowUps(data: { ids: string[] }): Promise<{
    total: number;
    succeeded: string[];
    failed: Array<{ id: string; reason: string }>;
  }> {
    const uniqueIds = Array.from(new Set(data.ids.filter((id) => Boolean(id && id.trim()))));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        const fu = await prisma.followUp.findUnique({
          where: { id },
        });

        if (!fu) {
          failed.push({ id, reason: 'Không tìm thấy lịch chăm sóc' });
          continue;
        }

        if (fu.status === FollowUpStatus.CANCELLED) {
          failed.push({ id, reason: 'Lịch chăm sóc đã bị hủy, không thể đánh dấu hoàn thành' });
          continue;
        }

        if (fu.status === FollowUpStatus.COMPLETED) {
          // Already completed, record as succeeded without duplicate activity
          succeeded.push(id);
          continue;
        }

        // Valid status for completion (PENDING / IN_PROGRESS)
        await prisma.$transaction(async (tx) => {
          await tx.followUp.update({
            where: { id },
            data: {
              status: FollowUpStatus.COMPLETED,
              completedAt: new Date(),
            },
          });

          await tx.customerActivity.create({
            data: {
              customerId: fu.customerId,
              type: ActivityType.SYSTEM_EVENT,
              title: `Follow-up COMPLETED: ${fu.title}`,
              description: `Lịch chăm sóc được đánh dấu hoàn thành qua thao tác hàng loạt.`,
            },
          });
        });

        succeeded.push(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái lịch chăm sóc';
        failed.push({ id, reason: msg });
      }
    }

    return {
      total: uniqueIds.length,
      succeeded,
      failed,
    };
  }

  /**
   * Bulk deletes follow-ups with safety verification.
   * Strictly prevents hard deleting COMPLETED follow-ups to preserve actual customer care history.
   * Protects financial cases, activities, and customer master records from cascade deletions.
   */
  async deleteBulkFollowUps(data: { ids: string[] }): Promise<{
    total: number;
    succeeded: string[];
    failed: Array<{ id: string; reason: string }>;
  }> {
    const uniqueIds = Array.from(new Set(data.ids.filter((id) => Boolean(id && id.trim()))));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        const fu = await prisma.followUp.findUnique({
          where: { id },
        });

        if (!fu) {
          failed.push({ id, reason: 'Không tìm thấy lịch chăm sóc' });
          continue;
        }

        if (fu.status === FollowUpStatus.COMPLETED) {
          failed.push({
            id,
            reason: 'Không thể xóa lịch đã hoàn thành vì đây là lịch sử chăm sóc thực tế của khách hàng',
          });
          continue;
        }

        // Safe to delete non-completed task (PENDING, IN_PROGRESS, CANCELLED)
        await prisma.followUp.delete({
          where: { id },
        });

        succeeded.push(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi khi xóa lịch chăm sóc';
        failed.push({ id, reason: msg });
      }
    }

    return {
      total: uniqueIds.length,
      succeeded,
      failed,
    };
  }

  /**
   * Bulk reopens completed follow-ups back to PENDING.
   * Clears completedAt without deleting history, notes, or customer linkages.
   */
  async reopenBulkFollowUps(data: { ids: string[] }): Promise<{
    total: number;
    succeeded: string[];
    failed: Array<{ id: string; reason: string }>;
  }> {
    const uniqueIds = Array.from(new Set(data.ids.filter((id) => Boolean(id && id.trim()))));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        const fu = await prisma.followUp.findUnique({
          where: { id },
        });

        if (!fu) {
          failed.push({ id, reason: 'Không tìm thấy lịch chăm sóc' });
          continue;
        }

        if (fu.status === FollowUpStatus.CANCELLED) {
          failed.push({ id, reason: 'Lịch chăm sóc đã bị hủy, không thể mở lại' });
          continue;
        }

        if (fu.status === FollowUpStatus.PENDING || fu.status === FollowUpStatus.IN_PROGRESS) {
          // Already open
          succeeded.push(id);
          continue;
        }

        // Status is COMPLETED: transition back to PENDING and clear completedAt
        await prisma.$transaction(async (tx) => {
          await tx.followUp.update({
            where: { id },
            data: {
              status: FollowUpStatus.PENDING,
              completedAt: null,
            },
          });

          await tx.customerActivity.create({
            data: {
              customerId: fu.customerId,
              type: ActivityType.SYSTEM_EVENT,
              title: `Mở lại lịch chăm sóc: ${fu.title}`,
              description: `Lịch chăm sóc được mở lại (chuyển từ Hoàn thành về Chưa hoàn thành).`,
            },
          });
        });

        succeeded.push(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi khi mở lại lịch chăm sóc';
        failed.push({ id, reason: msg });
      }
    }

    return {
      total: uniqueIds.length,
      succeeded,
      failed,
    };
  }

  /**
   * Bulk reassigns caregivers across multiple follow-ups.
   * Validates target caretaker, updates follow-up records, and synchronizes assignment grants.
   */
  async reassignBulkFollowUps(data: {
    ids: string[];
    assignedTo?: string | null;
    assignedToUserId?: string | null;
    assignedById?: string | null;
  }): Promise<{
    total: number;
    succeeded: string[];
    failed: Array<{ id: string; reason: string }>;
    targetCaregiver: string | null;
  }> {
    const uniqueIds = Array.from(new Set(data.ids.filter((id) => Boolean(id && id.trim()))));
    const succeeded: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    const validatedCaregiver = await this.validateAssignedTo(
      data.assignedToUserId !== undefined && data.assignedToUserId !== null
        ? data.assignedToUserId
        : data.assignedTo
    );

    const targetName = validatedCaregiver ? validatedCaregiver.name : null;
    const targetUserId = validatedCaregiver ? validatedCaregiver.userId : null;

    for (const id of uniqueIds) {
      try {
        const fu = await prisma.followUp.findUnique({
          where: { id },
        });

        if (!fu) {
          failed.push({ id, reason: 'Không tìm thấy lịch chăm sóc' });
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.followUp.update({
            where: { id },
            data: {
              assignedTo: targetName,
              assignedToUserId: targetUserId,
            },
          });

          // Synchronize customer assignment grant
          const syncRes = await assignmentSyncService.syncFollowUpAssignment(tx, {
            followUpId: id,
            customerId: fu.customerId,
            caregiverUserId: targetUserId,
            caregiverName: targetName,
            previousCaregiverName: fu.assignedTo,
            assignedById: data.assignedById || null,
          });

          await tx.customerActivity.create({
            data: {
              customerId: fu.customerId,
              type: ActivityType.SYSTEM_EVENT,
              title: `Đổi người chăm sóc: ${fu.title}`,
              description: `Người chăm sóc đổi từ "${fu.assignedTo || 'Chưa phân công'}" sang "${targetName || 'Chưa phân công'}".${syncRes.notice ? ` ${syncRes.notice}` : ''}`,
            },
          });
        });

        succeeded.push(id);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi khi cập nhật người chăm sóc';
        failed.push({ id, reason: msg });
      }
    }

    return {
      total: uniqueIds.length,
      succeeded,
      failed,
      targetCaregiver: targetName,
    };
  }
}

export const followUpService = new FollowUpService();
export default followUpService;
