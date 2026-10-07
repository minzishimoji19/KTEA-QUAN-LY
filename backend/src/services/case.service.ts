import { CaseStatus, CaseProgress, ActivityType } from '@prisma/client';
import { caseRepository } from '../repositories/case.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { productRepository } from '../repositories/product.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import BaseService from './base.service.js';
import prisma from '../config/database.js';

export const VALID_TRANSITIONS: Record<CaseProgress, CaseProgress[]> = {
  [CaseProgress.NOT_SELECTED]: [CaseProgress.REGISTRATION_CREATED],
  [CaseProgress.REGISTRATION_CREATED]: [CaseProgress.REGISTRATION_COMPLETED],
  [CaseProgress.REGISTRATION_COMPLETED]: [CaseProgress.UNDER_REVIEW],
  [CaseProgress.UNDER_REVIEW]: [CaseProgress.APPROVED],
  [CaseProgress.APPROVED]: [CaseProgress.CARD_ISSUED],
  [CaseProgress.CARD_ISSUED]: [CaseProgress.CARD_ACTIVATED],
  [CaseProgress.CARD_ACTIVATED]: [CaseProgress.COMPLETED],
  [CaseProgress.COMPLETED]: [],
};

export function isTerminalStatus(status: CaseStatus): boolean {
  return status === CaseStatus.REJECTED || status === CaseStatus.COMPLETED || status === CaseStatus.CANCELLED;
}

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
    productId?: string | null;
    caseStatus?: CaseStatus;
    progress?: CaseProgress;
    applicationDate?: string | Date | null;
    resultDate?: string | Date | null;
    failureReason?: string | null;
    notes?: string | null;
  }) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    let productName = 'None (Product not selected)';
    if (data.productId) {
      const product = await productRepository.findById(data.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID '${data.productId}' not found`);
      }
      if (!product.active) {
        throw new BadRequestError(`Product '${product.name}' is inactive and cannot be selected`);
      }
      productName = product.name;
    }

    const appDate = data.applicationDate ? new Date(data.applicationDate) : new Date();
    const resDate = data.resultDate ? new Date(data.resultDate) : null;

    const initialProgress = data.progress || (data.productId ? CaseProgress.REGISTRATION_CREATED : CaseProgress.NOT_SELECTED);
    const initialStatus = data.caseStatus || CaseStatus.ACTIVE;

    return prisma.$transaction(async (tx) => {
      const createdCase = await tx.customerCase.create({
        data: {
          customerId,
          productId: data.productId || null,
          caseStatus: initialStatus,
          progress: initialProgress,
          applicationDate: appDate,
          resultDate: resDate,
          failureReason: data.failureReason,
          notes: data.notes,
        },
        include: {
          product: true,
          progressHistory: true,
        },
      });

      // Log initial progress history
      await tx.caseProgressHistory.create({
        data: {
          caseId: createdCase.id,
          fromProgress: initialProgress,
          toProgress: initialProgress,
          note: `Case created with initial progress ${initialProgress}`,
        },
      });

      // Immutable customer activity log
      await tx.customerActivity.create({
        data: {
          customerId,
          type: ActivityType.CREATE_CASE,
          title: `Application Case Created: ${productName}`,
          description: `Created case #${createdCase.id.slice(0, 8)} with status ${initialStatus} and progress ${initialProgress}.`,
        },
      });

      return createdCase;
    });
  }

  async selectProduct(id: string, data: { productId: string }) {
    const current = await this.getCaseById(id);

    if (isTerminalStatus(current.caseStatus) || current.progress === CaseProgress.COMPLETED) {
      throw new BadRequestError(`Cannot select product for a case in terminal status (${current.caseStatus})`);
    }

    if (
      current.progress === CaseProgress.APPROVED ||
      current.progress === CaseProgress.CARD_ISSUED ||
      current.progress === CaseProgress.CARD_ACTIVATED
    ) {
      throw new BadRequestError(`Cannot change product for a case in progress state '${current.progress}'`);
    }

    const product = await productRepository.findById(data.productId);
    if (!product) {
      throw new NotFoundError(`Product with ID '${data.productId}' not found`);
    }
    if (!product.active) {
      throw new BadRequestError(`Product '${product.name}' is inactive and cannot be selected`);
    }

    const shouldTransitionToCreated = current.progress === CaseProgress.NOT_SELECTED;
    const targetProgress = shouldTransitionToCreated ? CaseProgress.REGISTRATION_CREATED : current.progress;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.customerCase.update({
        where: { id },
        data: {
          productId: product.id,
          progress: targetProgress,
        },
        include: {
          product: true,
          progressHistory: {
            orderBy: { changedAt: 'asc' },
          },
        },
      });

      if (shouldTransitionToCreated) {
        await tx.caseProgressHistory.create({
          data: {
            caseId: id,
            fromProgress: CaseProgress.NOT_SELECTED,
            toProgress: CaseProgress.REGISTRATION_CREATED,
            note: `Product selected: ${product.name} (${product.code})`,
          },
        });
      }

      await tx.customerActivity.create({
        data: {
          customerId: current.customerId,
          type: ActivityType.SELECT_PRODUCT,
          title: `Product Selected: ${product.name}`,
          description: `Case #${id.slice(0, 8)} assigned product ${product.name} (${product.code}).`,
        },
      });

      return updated;
    });
  }

  async updateProgress(id: string, data: { toProgress: CaseProgress; note?: string | null }) {
    const current = await this.getCaseById(id);

    if (isTerminalStatus(current.caseStatus) || current.progress === CaseProgress.COMPLETED) {
      throw new BadRequestError(`Cannot update progress for a case in terminal status (${current.caseStatus})`);
    }

    const allowedTransitions = VALID_TRANSITIONS[current.progress] || [];
    if (!allowedTransitions.includes(data.toProgress)) {
      throw new BadRequestError(`Invalid transition from '${current.progress}' to '${data.toProgress}'. Allowed: [${allowedTransitions.join(', ')}]`);
    }

    if (data.toProgress === CaseProgress.REGISTRATION_CREATED && !current.productId) {
      throw new BadRequestError('Cannot move to REGISTRATION_CREATED without a selected product');
    }

    let newStatus = current.caseStatus;
    let resultDate = current.resultDate;

    let activityType: ActivityType = ActivityType.PROGRESS_CHANGED;
    let activityTitle = `Case Progress: ${current.progress} -> ${data.toProgress}`;

    if (data.toProgress === CaseProgress.APPROVED) {
      newStatus = CaseStatus.APPROVED;
      resultDate = new Date();
      activityType = ActivityType.APPROVED;
      activityTitle = 'Case Approved';
    } else if (data.toProgress === CaseProgress.CARD_ISSUED) {
      activityType = ActivityType.CARD_ISSUED;
      activityTitle = 'Card Issued';
    } else if (data.toProgress === CaseProgress.CARD_ACTIVATED) {
      activityType = ActivityType.CARD_ACTIVATED;
      activityTitle = 'Card Activated';
    } else if (data.toProgress === CaseProgress.COMPLETED) {
      newStatus = CaseStatus.COMPLETED;
      resultDate = resultDate || new Date();
      activityType = ActivityType.COMPLETED;
      activityTitle = 'Case Completed';
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.customerCase.update({
        where: { id },
        data: {
          progress: data.toProgress,
          caseStatus: newStatus,
          resultDate,
        },
        include: {
          product: true,
          progressHistory: {
            orderBy: { changedAt: 'asc' },
          },
        },
      });

      await tx.caseProgressHistory.create({
        data: {
          caseId: id,
          fromProgress: current.progress,
          toProgress: data.toProgress,
          note: data.note || null,
        },
      });

      await tx.customerActivity.create({
        data: {
          customerId: current.customerId,
          type: activityType,
          title: activityTitle,
          description: `Case moved from ${current.progress} to ${data.toProgress}.${data.note ? ` Note: ${data.note}` : ''}`,
        },
      });

      return updated;
    });
  }

  async rejectCase(id: string, data: { reason: string; note?: string | null }) {
    const current = await this.getCaseById(id);

    if (isTerminalStatus(current.caseStatus)) {
      throw new BadRequestError(`Cannot reject case: already in terminal status (${current.caseStatus})`);
    }

    const rejectionDate = new Date();

    return prisma.$transaction(async (tx) => {
      const updated = await tx.customerCase.update({
        where: { id },
        data: {
          caseStatus: CaseStatus.REJECTED,
          rejectedAt: rejectionDate,
          rejectionReason: data.reason,
          rejectionNote: data.note || null,
          failureReason: data.reason,
          resultDate: rejectionDate,
        },
        include: {
          product: true,
          progressHistory: {
            orderBy: { changedAt: 'asc' },
          },
        },
      });

      await tx.caseProgressHistory.create({
        data: {
          caseId: id,
          fromProgress: current.progress,
          toProgress: current.progress,
          note: `Case Rejected: ${data.reason}${data.note ? ` (${data.note})` : ''}`,
        },
      });

      await tx.customerActivity.create({
        data: {
          customerId: current.customerId,
          type: ActivityType.REJECTED,
          title: 'Case Rejected',
          description: `Case #${id.slice(0, 8)} rejected. Reason: ${data.reason}.${data.note ? ` Note: ${data.note}` : ''}`,
        },
      });

      return updated;
    });
  }

  async updateCase(id: string, data: {
    productId?: string | null;
    caseStatus?: CaseStatus;
    progress?: CaseProgress;
    applicationDate?: string | Date | null;
    resultDate?: string | Date | null;
    failureReason?: string | null;
    notes?: string | null;
  }) {
    const current = await this.getCaseById(id);

    if (data.caseStatus && data.caseStatus !== current.caseStatus && isTerminalStatus(current.caseStatus)) {
      throw new BadRequestError(`Cannot update case in terminal status (${current.caseStatus})`);
    }

    const appDate = data.applicationDate !== undefined
      ? (data.applicationDate ? new Date(data.applicationDate) : null)
      : undefined;

    const resDate = data.resultDate !== undefined
      ? (data.resultDate ? new Date(data.resultDate) : null)
      : undefined;

    return prisma.$transaction(
      async (tx) => {
        const updated = await tx.customerCase.update({
        where: { id },
        data: {
          ...data,
          applicationDate: appDate,
          resultDate: resDate,
        },
        include: {
          product: true,
          progressHistory: {
            orderBy: { changedAt: 'asc' },
          },
        },
      });

      if (data.caseStatus && data.caseStatus !== current.caseStatus) {
        await tx.customerActivity.create({
          data: {
            customerId: current.customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: `Case Status Update`,
            description: `Case moved from ${current.caseStatus} to ${data.caseStatus}.${data.failureReason ? ` Reason: ${data.failureReason}` : ''}`,
          },
        });
      }

      return updated;
    }, { timeout: 20000, maxWait: 10000 });
  }

  async deleteCase(id: string) {
    await this.getCaseById(id);
    return caseRepository.delete(id);
  }
}

export const caseService = new CaseService();
export default caseService;

