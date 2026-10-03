import { NeedStatus, ActivityType } from '@prisma/client';
import { needRepository } from '../repositories/need.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { NotFoundError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class NeedService extends BaseService {
  async getNeedsByCustomerId(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return needRepository.findByCustomerId(customerId);
  }

  async getNeedById(id: string) {
    const need = await needRepository.findById(id);
    if (!need) {
      throw new NotFoundError(`Need with ID '${id}' not found`);
    }
    return need;
  }

  async createNeed(customerId: string, data: {
    needType: string;
    status?: NeedStatus;
    detectedAt?: string | Date;
    resolvedAt?: string | Date | null;
    notes?: string | null;
  }) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    const detDate = data.detectedAt ? new Date(data.detectedAt) : new Date();
    const resDate = data.resolvedAt ? new Date(data.resolvedAt) : null;

    return prisma.$transaction(async (tx) => {
      const need = await tx.customerNeed.create({
        data: {
          customerId,
          needType: data.needType,
          status: data.status || NeedStatus.OPEN,
          detectedAt: detDate,
          resolvedAt: resDate,
          notes: data.notes,
        },
      });

      await tx.customerActivity.create({
        data: {
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: `Customer Need Expressed: ${data.needType}`,
          description: `Identified customer need [${data.needType}] with status ${need.status}.`,
        },
      });

      return need;
    });
  }

  async updateNeed(id: string, data: {
    needType?: string;
    status?: NeedStatus;
    detectedAt?: string | Date;
    resolvedAt?: string | Date | null;
    notes?: string | null;
  }) {
    await this.getNeedById(id);

    const detDate = data.detectedAt !== undefined
      ? (data.detectedAt ? new Date(data.detectedAt) : undefined)
      : undefined;

    const resDate = data.resolvedAt !== undefined
      ? (data.resolvedAt ? new Date(data.resolvedAt) : null)
      : undefined;

    return needRepository.update(id, {
      ...data,
      detectedAt: detDate,
      resolvedAt: resDate,
    });
  }

  async deleteNeed(id: string) {
    await this.getNeedById(id);
    return needRepository.delete(id);
  }
}

export const needService = new NeedService();
export default needService;
