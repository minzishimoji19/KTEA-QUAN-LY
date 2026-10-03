import { Prisma, NeedStatus } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class NeedRepository extends BaseRepository {
  async findByCustomerId(customerId: string) {
    return this.db.customerNeed.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.db.customerNeed.findUnique({
      where: { id },
    });
  }

  async create(customerId: string, data: {
    needType: string;
    status?: NeedStatus;
    detectedAt?: Date;
    resolvedAt?: Date | null;
    notes?: string | null;
  }) {
    return this.db.customerNeed.create({
      data: {
        ...data,
        customerId,
      },
    });
  }

  async update(id: string, data: Prisma.CustomerNeedUpdateInput) {
    return this.db.customerNeed.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.customerNeed.delete({
      where: { id },
    });
  }
}

export const needRepository = new NeedRepository();
export default needRepository;
