import { PushStatus, ActivityType, RecommendationStatus } from '@prisma/client';
import { pushRecordRepository } from '../repositories/pushRecord.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { recommendationRepository } from '../repositories/recommendation.repository.js';
import { NotFoundError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export class PushRecordService extends BaseService {
  async getAllPushRecords(status?: PushStatus) {
    return pushRecordRepository.findAll(status);
  }

  async getPushRecordsByCustomerId(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return pushRecordRepository.findByCustomerId(customerId);
  }

  async getPushRecordById(id: string) {
    const pushRecord = await pushRecordRepository.findById(id);
    if (!pushRecord) {
      throw new NotFoundError(`Push record with ID '${id}' not found`);
    }
    return pushRecord;
  }

  async createPushRecord(customerId: string, data: {
    targetProductId?: string | null;
    recommendationId?: string | null;
    status?: PushStatus;
    note?: string | null;
  }) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    let productName = 'General Specialist Desk';
    if (data.targetProductId) {
      const product = await productRepository.findById(data.targetProductId);
      if (!product) {
        throw new NotFoundError(`Product with ID '${data.targetProductId}' not found`);
      }
      productName = product.name;
    }

    if (data.recommendationId) {
      const rec = await recommendationRepository.findById(data.recommendationId);
      if (!rec) {
        throw new NotFoundError(`Recommendation with ID '${data.recommendationId}' not found`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const pushRecord = await tx.pushRecord.create({
        data: {
          customerId,
          targetProductId: data.targetProductId,
          recommendationId: data.recommendationId,
          status: data.status || PushStatus.PENDING,
          note: data.note,
        },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
          targetProduct: true,
          recommendation: true,
        },
      });

      // If linked to a recommendation, mark recommendation as ACCEPTED
      if (data.recommendationId) {
        await tx.recommendation.update({
          where: { id: data.recommendationId },
          data: { status: RecommendationStatus.CONVERTED_TO_PUSH },
        });
      }

      // Log immutable push activity
      await tx.customerActivity.create({
        data: {
          customerId,
          type: ActivityType.PUSH_SENT,
          title: `Customer Referred / Pushed: ${productName}`,
          description: `Dispatched customer referral. Initial status: ${pushRecord.status}.${data.note ? ` Note: ${data.note}` : ''}`,
        },
      });

      return pushRecord;
    });
  }

  async updatePushRecord(id: string, data: {
    status?: PushStatus;
    resultAt?: string | Date | null;
    failureReason?: string | null;
    note?: string | null;
  }) {
    const current = await this.getPushRecordById(id);

    let resDate = data.resultAt !== undefined
      ? (data.resultAt ? new Date(data.resultAt) : null)
      : undefined;

    // Auto set result timestamp on terminal states
    const terminalStatuses: PushStatus[] = [PushStatus.SUCCESS, PushStatus.FAILED, PushStatus.CANCELLED];
    if (data.status && terminalStatuses.includes(data.status)) {
      if (!current.resultAt && resDate === undefined) {
        resDate = new Date();
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.pushRecord.update({
        where: { id },
        data: {
          status: data.status,
          resultAt: resDate,
          failureReason: data.failureReason,
          note: data.note,
        },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
          targetProduct: true,
          recommendation: true,
        },
      });

      if (data.status && data.status !== current.status) {
        await tx.customerActivity.create({
          data: {
            customerId: current.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Push Outcome: ${data.status}`,
            description: `Referral outcome updated to ${data.status}.${data.failureReason ? ` Failure Reason: ${data.failureReason}` : ''}`,
          },
        });
      }

      return updated;
    });
  }
}

export const pushRecordService = new PushRecordService();
export default pushRecordService;
