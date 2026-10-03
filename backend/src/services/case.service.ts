import { CaseStatus, ActivityType } from '@prisma/client';
import { caseRepository } from '../repositories/case.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { NotFoundError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class CaseService extends BaseService {
  async getCasesByCustomerId(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return caseRepository.findByCustomerId(customerId);
  }

  async getCaseById(id: string) {
    const customerCase = await caseRepository.findById(id);
    if (!customerCase) {
      throw new NotFoundError(`Case with ID '${id}' not found`);
    }
    return customerCase;
  }

  async createCase(customerId: string, data: {
    productId: string;
    caseStatus?: CaseStatus;
    applicationDate?: string | Date | null;
    resultDate?: string | Date | null;
    failureReason?: string | null;
    notes?: string | null;
  }) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    const product = await productRepository.findById(data.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID '${data.productId}' not found`);
    }

    const appDate = data.applicationDate ? new Date(data.applicationDate) : new Date();
    const resDate = data.resultDate ? new Date(data.resultDate) : null;

    return prisma.$transaction(async (tx) => {
      const createdCase = await tx.customerCase.create({
        data: {
          customerId,
          productId: data.productId,
          caseStatus: data.caseStatus || CaseStatus.DRAFT,
          applicationDate: appDate,
          resultDate: resDate,
          failureReason: data.failureReason,
          notes: data.notes,
        },
        include: { product: true },
      });

      // Immutable activity log
      await tx.customerActivity.create({
        data: {
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: `Application Case Initiated: ${product.name}`,
          description: `Logged case with initial status ${createdCase.caseStatus}. Application date: ${appDate.toISOString().split('T')[0]}.`,
        },
      });

      return createdCase;
    });
  }

  async updateCase(id: string, data: {
    productId?: string;
    caseStatus?: CaseStatus;
    applicationDate?: string | Date | null;
    resultDate?: string | Date | null;
    failureReason?: string | null;
    notes?: string | null;
  }) {
    const current = await this.getCaseById(id);

    const appDate = data.applicationDate !== undefined
      ? (data.applicationDate ? new Date(data.applicationDate) : null)
      : undefined;

    const resDate = data.resultDate !== undefined
      ? (data.resultDate ? new Date(data.resultDate) : null)
      : undefined;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.customerCase.update({
        where: { id },
        data: {
          ...data,
          applicationDate: appDate,
          resultDate: resDate,
        },
        include: { product: true },
      });

      if (data.caseStatus && data.caseStatus !== current.caseStatus) {
        await tx.customerActivity.create({
          data: {
            customerId: current.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Case Status Update: ${current.product.name}`,
            description: `Case moved from ${current.caseStatus} to ${data.caseStatus}.${data.failureReason ? ` Reason: ${data.failureReason}` : ''}`,
          },
        });
      }

      return updated;
    });
  }

  async deleteCase(id: string) {
    await this.getCaseById(id);
    return caseRepository.delete(id);
  }
}

export const caseService = new CaseService();
export default caseService;
