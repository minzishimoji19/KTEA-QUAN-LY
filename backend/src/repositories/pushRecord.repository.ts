import { Prisma, PushStatus } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class PushRecordRepository extends BaseRepository {
  async findAll(status?: PushStatus, scopedCustomerIds?: string[]) {
    const where: Prisma.PushRecordWhereInput = {};
    if (status) {
      where.status = status;
    }
    if (scopedCustomerIds !== undefined) {
      where.customerId = { in: scopedCustomerIds };
    }
    return this.db.pushRecord.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true, overallStatus: true },
        },
        targetProduct: true,
        recommendation: true,
      },
      orderBy: { pushedAt: 'desc' },
    });
  }

  async findByCustomerId(customerId: string) {
    return this.db.pushRecord.findMany({
      where: { customerId },
      include: {
        targetProduct: true,
        recommendation: true,
      },
      orderBy: { pushedAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.db.pushRecord.findUnique({
      where: { id },
      include: {
        customer: true,
        targetProduct: true,
        recommendation: true,
      },
    });
  }

  async create(customerId: string, data: {
    targetProductId?: string | null;
    recommendationId?: string | null;
    status?: PushStatus;
    note?: string | null;
  }) {
    return this.db.pushRecord.create({
      data: {
        ...data,
        customerId,
      },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        targetProduct: true,
        recommendation: true,
      },
    });
  }

  async update(id: string, data: Prisma.PushRecordUpdateInput) {
    return this.db.pushRecord.update({
      where: { id },
      data,
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        targetProduct: true,
        recommendation: true,
      },
    });
  }
}

export const pushRecordRepository = new PushRecordRepository();
export default pushRecordRepository;
