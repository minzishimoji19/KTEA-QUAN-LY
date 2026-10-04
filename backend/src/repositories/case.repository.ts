import { Prisma, CaseStatus, CaseProgress } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class CaseRepository extends BaseRepository {
  async findByCustomerId(customerId: string) {
    return this.db.customerCase.findMany({
      where: { customerId },
      include: {
        product: true,
        progressHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.db.customerCase.findUnique({
      where: { id },
      include: {
        product: true,
        customer: true,
        progressHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  }

  async create(customerId: string, data: {
    productId?: string | null;
    caseStatus?: CaseStatus;
    progress?: CaseProgress;
    applicationDate?: Date | null;
    resultDate?: Date | null;
    failureReason?: string | null;
    notes?: string | null;
  }) {
    return this.db.customerCase.create({
      data: {
        customerId,
        productId: data.productId || null,
        caseStatus: data.caseStatus || CaseStatus.ACTIVE,
        progress: data.progress || (data.productId ? CaseProgress.REGISTRATION_CREATED : CaseProgress.NOT_SELECTED),
        applicationDate: data.applicationDate,
        resultDate: data.resultDate,
        failureReason: data.failureReason,
        notes: data.notes,
      },
      include: {
        product: true,
        progressHistory: true,
      },
    });
  }

  async update(id: string, data: Prisma.CustomerCaseUpdateInput) {
    return this.db.customerCase.update({
      where: { id },
      data,
      include: {
        product: true,
        progressHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  }

  async createProgressHistory(data: {
    caseId: string;
    fromProgress: CaseProgress;
    toProgress: CaseProgress;
    note?: string | null;
  }) {
    return this.db.caseProgressHistory.create({
      data: {
        caseId: data.caseId,
        fromProgress: data.fromProgress,
        toProgress: data.toProgress,
        note: data.note,
      },
    });
  }

  async delete(id: string) {
    return this.db.customerCase.delete({
      where: { id },
    });
  }
}

export const caseRepository = new CaseRepository();
export default caseRepository;

