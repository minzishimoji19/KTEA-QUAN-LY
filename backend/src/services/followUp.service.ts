import { FollowUpStatus, ActivityType } from '@prisma/client';
import { followUpRepository } from '../repositories/followUp.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { NotFoundError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class FollowUpService extends BaseService {
  async getFollowUps(filter?: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all', status?: FollowUpStatus, customerId?: string) {
    if (customerId) {
      const customer = await customerRepository.findById(customerId);
      if (!customer) {
        throw new NotFoundError(`Customer with ID '${customerId}' not found`);
      }
    }
    return followUpRepository.findAll(filter, status, customerId);
  }

  async getFollowUpById(id: string) {
    const followUp = await followUpRepository.findById(id);
    if (!followUp) {
      throw new NotFoundError(`Follow-up with ID '${id}' not found`);
    }
    return followUp;
  }

  async createFollowUp(data: {
    customerId: string;
    title: string;
    description?: string | null;
    dueAt: string | Date;
    status?: FollowUpStatus;
  }) {
    const customer = await customerRepository.findById(data.customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${data.customerId}' not found`);
    }

    const dueDate = new Date(data.dueAt);

    return prisma.$transaction(async (tx) => {
      const followUp = await tx.followUp.create({
        data: {
          customerId: data.customerId,
          title: data.title,
          description: data.description,
          dueAt: dueDate,
          status: data.status || FollowUpStatus.PENDING,
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
          description: `Due date set for ${dueDate.toISOString().split('T')[0]}.`,
        },
      });

      return followUp;
    });
  }

  async updateFollowUp(id: string, data: {
    title?: string;
    description?: string | null;
    dueAt?: string | Date;
    status?: FollowUpStatus;
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

    return prisma.$transaction(async (tx) => {
      const updated = await tx.followUp.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description,
          dueAt: dueDate,
          status: data.status,
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
    await this.getFollowUpById(id);
    return followUpRepository.delete(id);
  }
}

export const followUpService = new FollowUpService();
export default followUpService;
