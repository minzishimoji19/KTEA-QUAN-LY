import { CustomerStatus, Gender, PriorityLevel, ActivityType } from '@prisma/client';
import { customerRepository, CustomerQueryFilters } from '../repositories/customer.repository.js';
import { tagRepository } from '../repositories/tag.repository.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { buildPaginationMeta } from '../utils/db.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class CustomerService extends BaseService {
  async getCustomers(filters: CustomerQueryFilters) {
    const { total, customers } = await customerRepository.findMany(filters);
    const pagination = buildPaginationMeta(total, filters.page, filters.pageSize);

    return {
      items: customers,
      pagination,
    };
  }

  async getCustomerById(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }
    return customer;
  }

  async getCustomerDetail(id: string) {
    const customer = await customerRepository.findDetailById(id);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }
    return customer;
  }

  async createCustomer(data: {
    fullName: string;
    phone: string;
    email?: string | null;
    gender?: Gender | null;
    dateOfBirth?: string | Date | null;
    address?: string | null;
    source?: string | null;
    overallStatus?: CustomerStatus;
    priority?: PriorityLevel | null;
  }) {
    // Check if phone already registered
    const existing = await customerRepository.findByPhone(data.phone);
    if (existing) {
      throw new ConflictError(`A customer with phone '${data.phone}' already exists (${existing.fullName})`);
    }

    const birthDate = data.dateOfBirth ? new Date(data.dateOfBirth) : null;

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
          source: data.source,
          overallStatus: data.overallStatus || CustomerStatus.LEAD,
          priority: data.priority,
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

      return customer;
    });
  }

  async updateCustomer(id: string, data: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    gender?: Gender | null;
    dateOfBirth?: string | Date | null;
    address?: string | null;
    source?: string | null;
    overallStatus?: CustomerStatus;
    priority?: PriorityLevel | null;
  }) {
    const current = await this.getCustomerById(id);

    // If phone is being changed, check uniqueness
    if (data.phone && data.phone !== current.phone) {
      const existing = await customerRepository.findByPhone(data.phone);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Phone '${data.phone}' is already assigned to ${existing.fullName}`);
      }
    }

    const birthDate = data.dateOfBirth !== undefined
      ? (data.dateOfBirth ? new Date(data.dateOfBirth) : null)
      : undefined;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          ...data,
          dateOfBirth: birthDate,
        },
      });

      // If status changed, log immutable lifecycle activity
      if (data.overallStatus && data.overallStatus !== current.overallStatus) {
        await tx.customerActivity.create({
          data: {
            customerId: id,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Overall Status Transition',
            description: `Customer lifecycle status shifted from ${current.overallStatus} to ${data.overallStatus}.`,
          },
        });
      }

      return updated;
    });
  }

  async deleteCustomer(id: string) {
    await this.getCustomerById(id);
    return customerRepository.delete(id);
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
