import { FollowUpStatus, ActivityType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { followUpRepository } from '../repositories/followUp.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { caretakerRepository } from '../repositories/caretaker.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';
import { pushNotificationService } from './pushNotification.service.js';

export class FollowUpService extends BaseService {
  /**
   * Validates assignedTo name against caretakers catalog.
   * If allowInactiveIfCurrentSame is provided and matches the caretaker, allows keeping inactive caretaker on existing records.
   */
  async validateAssignedTo(name?: string | null, allowInactiveIfCurrentSame?: string | null): Promise<string | null> {
    if (!name || typeof name !== 'string') {
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }

    const caretaker = await caretakerRepository.findByName(trimmed);
    if (!caretaker) {
      throw new BadRequestError(`Người chăm sóc '${trimmed}' không tồn tại trong hệ thống. Vui lòng thêm người chăm sóc trước.`);
    }

    if (!caretaker.active) {
      const isSameAsCurrent = allowInactiveIfCurrentSame && allowInactiveIfCurrentSame.toLowerCase() === caretaker.name.toLowerCase();
      if (!isSameAsCurrent) {
        throw new BadRequestError(`Người chăm sóc '${caretaker.name}' đã ngừng hoạt động và không thể phân công mới.`);
      }
    }

    return caretaker.name;
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
    const caretaker = await this.validateAssignedTo(data.assignedTo);
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
          },
          include: {
            customer: {
              select: { id: true, fullName: true, phone: true },
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
          },
          include: {
            customer: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        });

        await tx.customerActivity.create({
          data: {
            customerId: data.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Follow-up Scheduled: ${data.title}`,
            description: `Due date set for ${dueDateStr}${caretaker ? ` | Người chăm sóc: ${caretaker}` : ''}.`,
          },
        });

        return created;
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
  }) {
    const { customerIds, title, description, dueAt, status, assignedTo } = data;
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
    const caretaker = await this.validateAssignedTo(assignedTo);
    const desc = description !== undefined ? description : null;
    const dueDateStr = dueDate.toISOString().split('T')[0];
    const BATCH_SIZE = 250;

    const result = await prisma.$transaction(
      async (tx) => {
        // Row-level lock on customers to serialize concurrent requests on the same customers
        if (uniqueCustomerIds.length > 0) {
          await tx.$queryRaw`SELECT id FROM customers WHERE id IN (${Prisma.join(uniqueCustomerIds)}) FOR UPDATE`;
        }

        // Check for existing follow-ups with same criteria to prevent duplicate records on retry
        const existingFollowUps = await tx.followUp.findMany({
          where: {
            customerId: { in: uniqueCustomerIds },
            title,
            dueAt: dueDate,
            status: followUpStatus,
            assignedTo: caretaker,
          },
          include: {
            customer: {
              select: { id: true, fullName: true, phone: true },
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
        }));

        const activityRecords = customersToCreate.map((customer) => ({
          id: randomUUID(),
          customerId: customer.id,
          type: ActivityType.SYSTEM_EVENT,
          title: `Lên lịch chăm sóc: ${title}`,
          description: `Hạn chăm sóc: ${dueDateStr}${caretaker ? ` | Người chăm sóc: ${caretaker}` : ''}.`,
        }));

        // Batch insert follow-ups
        for (let i = 0; i < followUpRecords.length; i += BATCH_SIZE) {
          const batch = followUpRecords.slice(i, i + BATCH_SIZE);
          await tx.followUp.createMany({
            data: batch,
          });
        }

        // Batch insert customer activities
        for (let i = 0; i < activityRecords.length; i += BATCH_SIZE) {
          const batch = activityRecords.slice(i, i + BATCH_SIZE);
          await tx.customerActivity.createMany({
            data: batch,
          });
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
        maxWait: 5000,
        timeout: 15000,
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

    const validatedCaretaker = data.assignedTo !== undefined
      ? await this.validateAssignedTo(data.assignedTo, current.assignedTo)
      : undefined;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          dueAt: dueDate,
          status: data.status,
          assignedTo: validatedCaretaker,
          completedAt: completionDate,
        },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
        },
      });

      if (data.status && data.status !== current.status) {
        await tx.customerActivity.create({
          data: {
            customerId: current.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Follow-up ${data.status}: ${current.title}`,
            description: `Status changed from ${current.status} to ${data.status}.`,
          },
        });
      }

      return updated;
    });
  }

  async deleteFollowUp(id: string) {
    const current = await this.getFollowUpById(id);
    if (current.status === FollowUpStatus.COMPLETED) {
      throw new BadRequestError('Không thể xóa lịch chăm sóc đã hoàn thành vì đây là lịch sử chăm sóc thực tế của khách hàng.');
    }
    return followUpRepository.delete(id);
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
}

export const followUpService = new FollowUpService();
export default followUpService;
