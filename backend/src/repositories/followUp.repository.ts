import { Prisma, FollowUpStatus } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class FollowUpRepository extends BaseRepository {
  async findAll(filter?: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all', status?: FollowUpStatus, customerId?: string) {
    const where: Prisma.FollowUpWhereInput = {};

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      where.status = status;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (filter === 'today') {
      where.dueAt = {
        gte: startOfToday,
        lte: endOfToday,
      };
      if (!status) {
        where.status = { not: FollowUpStatus.CANCELLED };
      }
    } else if (filter === 'overdue') {
      where.dueAt = {
        lt: now,
      };
      where.status = {
        in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS],
      };
    } else if (filter === 'upcoming') {
      where.dueAt = {
        gt: endOfToday,
      };
      where.status = {
        in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS],
      };
    } else if (filter === 'completed') {
      where.status = FollowUpStatus.COMPLETED;
    }

    return this.db.followUp.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            overallStatus: true,
            priority: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  async findById(id: string) {
    return this.db.followUp.findUnique({
      where: { id },
      include: { customer: true },
    });
  }

  async create(data: {
    customerId: string;
    title: string;
    description?: string | null;
    dueAt: Date;
    status?: FollowUpStatus;
  }) {
    return this.db.followUp.create({
      data,
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  }

  async update(id: string, data: Prisma.FollowUpUpdateInput) {
    return this.db.followUp.update({
      where: { id },
      data,
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  }

  async delete(id: string) {
    return this.db.followUp.delete({
      where: { id },
    });
  }
}

export const followUpRepository = new FollowUpRepository();
export default followUpRepository;
