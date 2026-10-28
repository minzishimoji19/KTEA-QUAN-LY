import { CustomerStatus, Gender, PriorityLevel, ActivityType, Role } from '@prisma/client';
import { customerRepository } from '../repositories/customer.repository.js';
import { customerSourceRepository } from '../repositories/customerSource.repository.js';
import { tagRepository } from '../repositories/tag.repository.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/db.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';
import { enrichCustomerWithStatus } from './customerStatus.service.js';
import { parseStrictDateOnly } from '../utils/dateUtils.js';

import { CustomerQueryFilters } from '../repositories/customer.repository.js';

export class CustomerService extends BaseService {
  async getCustomers(filters: CustomerQueryFilters) {
    if (filters.sourceId) {
      const trimmedSourceId = filters.sourceId.trim();
      const source = await customerSourceRepository.findById(trimmedSourceId);
      if (!source) {
        throw new NotFoundError(`Customer source with ID '${filters.sourceId}' not found`);
      }
      filters.sourceId = trimmedSourceId;
    }

    const { total, customers } = await customerRepository.findMany(filters);
    const pagination = buildPaginationMeta(total, filters.page || 1, filters.pageSize || 10);
    const scopedPartner = filters.scopedPartner || (filters.scopedUserId ? { userId: filters.scopedUserId } : undefined);

    return {
      items: customers.map((c) => enrichCustomerWithStatus(c, scopedPartner)),
      pagination,
    };
  }

  async getCustomerById(
    id: string,
    scopedUserId?: string,
    scopedPartner?: CustomerQueryFilters['scopedPartner']
  ) {
    const customer = await customerRepository.findById(id, scopedUserId, scopedPartner);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }
    const partnerCtx = scopedPartner || (scopedUserId ? { userId: scopedUserId } : undefined);
    return enrichCustomerWithStatus(customer, partnerCtx);
  }

  async getCustomerDetail(
    id: string,
    scopedUserId?: string,
    scopedPartner?: CustomerQueryFilters['scopedPartner']
  ) {
    const customer = await customerRepository.findDetailById(id, scopedUserId, scopedPartner);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }

    const partnerCtx = scopedPartner || (scopedUserId ? { userId: scopedUserId } : undefined);
    let filteredActivities = customer.activities;

    // Scope schedule-specific activities for Partner so other partners' private schedule events do not leak
    if (partnerCtx?.userId && Array.isArray(customer.activities)) {
      const visibleFollowUpTitles = new Set(
        (customer.followUps || []).map((f: any) => String(f.title || '').trim()).filter(Boolean)
      );
      const schedulePrefixes = [
        'Follow-up Scheduled: ',
        'Lên lịch chăm sóc: ',
        'Follow-up PENDING: ',
        'Follow-up IN_PROGRESS: ',
        'Follow-up COMPLETED: ',
        'Follow-up CANCELLED: ',
        'Đổi người chăm sóc: ',
        'Cập nhật ghi chú lịch chăm sóc: ',
        'Mở lại lịch chăm sóc: ',
      ];

      filteredActivities = customer.activities.filter((act: any) => {
        const title = String(act.title || '');
        const matchedPrefix = schedulePrefixes.find((p) => title.startsWith(p));
        if (!matchedPrefix) return true;
        const scheduleTitle = title.slice(matchedPrefix.length).trim();
        return visibleFollowUpTitles.has(scheduleTitle);
      });
    }

    return enrichCustomerWithStatus(
      {
        ...customer,
        activities: filteredActivities,
        source: customer.source || customer.customerSource?.name || null,
        note: customer.note || customer.address || null,
      },
      partnerCtx
    );
  }

  async createCustomer(data: {
    fullName: string;
    phone: string;
    email?: string | null;
    gender?: Gender | null;
    dateOfBirth?: string | Date | null;
    address?: string | null;
    note?: string | null;
    source?: string | null;
    sourceId?: string | null;
    overallStatus?: CustomerStatus;
    priority?: PriorityLevel | null;
  }) {
    // Check if phone already registered
    const existing = await customerRepository.findByPhone(data.phone);
    if (existing) {
      throw new ConflictError(`A customer with phone '${data.phone}' already exists (${existing.fullName})`);
    }

    let resolvedSourceId: string | null = null;
    let resolvedSourceName: string | null = data.source || null;

    if (data.sourceId) {
      const source = await customerSourceRepository.findById(data.sourceId);
      if (!source) {
        throw new NotFoundError(`Customer source with ID '${data.sourceId}' not found`);
      }
      if (!source.active) {
        throw new BadRequestError(`Customer source '${source.name}' is inactive and cannot be selected for a new customer`);
      }
      resolvedSourceId = source.id;
      resolvedSourceName = source.name;
    } else if (data.source && data.source.trim()) {
      const matched = await customerSourceRepository.findByName(data.source.trim());
      if (matched) {
        if (!matched.active) {
          throw new BadRequestError(`Customer source '${matched.name}' is inactive and cannot be selected for a new customer`);
        }
        resolvedSourceId = matched.id;
        resolvedSourceName = matched.name;
      }
    }

    let birthDate: Date | null = null;
    if (data.dateOfBirth) {
      if (typeof data.dateOfBirth === 'string') {
        const strict = parseStrictDateOnly(data.dateOfBirth);
        if (!strict) {
          throw new BadRequestError('Ngày sinh không hợp lệ (vui lòng nhập ngày thực tế)');
        }
        birthDate = strict.utcNoonDate;
      } else {
        birthDate = new Date(data.dateOfBirth);
      }
    }
    const resolvedNote = data.note !== undefined ? data.note : (data.address || null);

    // Execute atomic creation + initial lifecycle activity event
    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          gender: data.gender,
          dateOfBirth: birthDate,
          address: data.address,
          note: resolvedNote,
          source: resolvedSourceName,
          sourceId: resolvedSourceId,
          overallStatus: data.overallStatus || CustomerStatus.LEAD_MOI,
          priority: data.priority,
        },
        include: {
          customerSource: true,
        },
      });

      await tx.customerActivity.create({
        data: {
          customerId: customer.id,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Customer Profile Created',
          description: `Customer record initiated with status ${customer.overallStatus} via ${customer.source || 'Direct Operator'}.`,
        },
      });

      return enrichCustomerWithStatus(customer);
    });
  }

  async updateCustomer(
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      email?: string | null;
      gender?: Gender | null;
      dateOfBirth?: string | Date | null;
      address?: string | null;
      note?: string | null;
      source?: string | null;
      sourceId?: string | null;
      overallStatus?: CustomerStatus;
      priority?: PriorityLevel | null;
    },
    actorUser?: { userId?: string; role?: Role; fullName?: string; email?: string }
  ) {
    const current = await this.getCustomerById(id);

    // If phone is being changed, check uniqueness
    if (data.phone && data.phone !== current.phone) {
      const existing = await customerRepository.findByPhone(data.phone);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Phone '${data.phone}' is already assigned to ${existing.fullName}`);
      }
    }

    let updateSourceId: string | null | undefined = undefined;
    let updateSourceName: string | null | undefined = undefined;

    if (data.sourceId !== undefined) {
      if (data.sourceId === null) {
        updateSourceId = null;
      } else {
        const source = await customerSourceRepository.findById(data.sourceId);
        if (!source) {
          throw new NotFoundError(`Customer source with ID '${data.sourceId}' not found`);
        }
        if (!source.active && current.sourceId !== data.sourceId) {
          throw new BadRequestError(`Cannot assign inactive source '${source.name}'`);
        }
        updateSourceId = source.id;
        updateSourceName = source.name;
      }
    } else if (data.source !== undefined && data.source !== null && data.source.trim()) {
      const matched = await customerSourceRepository.findByName(data.source.trim());
      if (matched) {
        updateSourceId = matched.id;
        updateSourceName = matched.name;
      } else {
        updateSourceName = data.source.trim();
      }
    }

    let birthDate: Date | null | undefined = undefined;
    if (data.dateOfBirth !== undefined) {
      if (!data.dateOfBirth) {
        birthDate = null;
      } else if (typeof data.dateOfBirth === 'string') {
        const strict = parseStrictDateOnly(data.dateOfBirth);
        if (!strict) {
          throw new BadRequestError('Ngày sinh không hợp lệ (vui lòng nhập ngày thực tế)');
        }
        birthDate = strict.utcNoonDate;
      } else {
        birthDate = new Date(data.dateOfBirth);
      }
    }

    const currentStatusValue = current.rawOverallStatus || current.overallStatus;

    await prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          ...data,
          dateOfBirth: birthDate,
          ...(data.note !== undefined ? { note: data.note } : {}),
          ...(updateSourceId !== undefined ? { sourceId: updateSourceId } : {}),
          ...(updateSourceName !== undefined ? { source: updateSourceName } : {}),
        },
      });

      // If status changed, log immutable lifecycle activity
      if (data.overallStatus && data.overallStatus !== currentStatusValue) {
        const actorDesc = actorUser ? ` bởi ${actorUser.role} (${actorUser.fullName || actorUser.email || actorUser.userId})` : '';
        await tx.customerActivity.create({
          data: {
            customerId: id,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Overall Status Transition',
            description: `Customer lifecycle status shifted from ${currentStatusValue} to ${data.overallStatus}${actorDesc}.`,
          },
        });
      }
    });

    return this.getCustomerDetail(id);
  }

  async deleteCustomer(id: string) {
    const customer = await this.getCustomerById(id);
    // Protect business relations
    const relatedCount = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { cases: true, notes: true, followUps: true, pushRecords: true },
        },
      },
    });

    if (
      relatedCount &&
      (relatedCount._count.cases > 0 ||
        relatedCount._count.notes > 0 ||
        relatedCount._count.followUps > 0 ||
        relatedCount._count.pushRecords > 0)
    ) {
      throw new BadRequestError('Không thể xóa khách hàng có hồ sơ vay, ghi chú, lịch chăm sóc hoặc dữ liệu chuyển khách đang hoạt động.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.customerTag.deleteMany({ where: { customerId: id } });
      await tx.customerActivity.deleteMany({ where: { customerId: id } });
      await tx.customerNeed.deleteMany({ where: { customerId: id } });
      await tx.recommendation.deleteMany({ where: { customerId: id } });
      return tx.customer.delete({ where: { id } });
    });
  }

  async addTag(customerId: string, tagId: string) {
    await this.getCustomerById(customerId);
    const tag = await tagRepository.findById(tagId);
    if (!tag) {
      throw new NotFoundError(`Tag with ID '${tagId}' not found`);
    }

    return prisma.$transaction(async (tx) => {
      const relation = await tx.customerTag.upsert({
        where: { customerId_tagId: { customerId, tagId } },
        create: { customerId, tagId },
        update: {},
        include: { tag: true },
      });

      await tx.customerActivity.create({
        data: {
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Tag Applied',
          description: `Applied tag [${tag.name}] to customer profile.`,
        },
      });

      return relation;
    });
  }

  async removeTag(customerId: string, tagId: string) {
    await this.getCustomerById(customerId);
    const tag = await tagRepository.findById(tagId);
    if (!tag) {
      throw new NotFoundError(`Tag with ID '${tagId}' not found`);
    }

    return prisma.$transaction(async (tx) => {
      await tx.customerTag.delete({
        where: { customerId_tagId: { customerId, tagId } },
      });

      await tx.customerActivity.create({
        data: {
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Tag Removed',
          description: `Removed tag [${tag.name}] from customer profile.`,
        },
      });

      return { message: `Tag [${tag.name}] removed successfully` };
    });
  }
}

export const customerService = new CustomerService();
export default customerService;
