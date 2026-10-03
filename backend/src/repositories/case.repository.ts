import { Prisma, CaseStatus } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class CaseRepository extends BaseRepository {
  async findByCustomerId(customerId: string) {
    return this.db.customerCase.findMany({
      where: { customerId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.db.customerCase.findUnique({
      where: { id },
      include: { product: true, customer: true },
    });
  }

  async create(customerId: string, data: {
    productId: string;
    caseStatus?: CaseStatus;
    applicationDate?: Date | null;
    resultDate?: Date | null;
    failureReason?: string | null;
    notes?: string | null;
  }) {
    return this.db.customerCase.create({
      data: {
        ...data,
        customerId,
      },
      include: { product: true },
    });
  }

  async update(id: string, data: Prisma.CustomerCaseUpdateInput) {
    return this.db.customerCase.update({
      where: { id },
      data,
      include: { product: true },
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
