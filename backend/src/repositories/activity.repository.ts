import { ActivityType } from '@prisma/client';
import BaseRepository from './base.repository.js';

export class ActivityRepository extends BaseRepository {
  async findByCustomerId(customerId: string) {
    return this.db.customerActivity.findMany({
      where: { customerId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async create(customerId: string, data: {
    type: ActivityType;
    title: string;
    description?: string | null;
    occurredAt?: Date;
  }) {
    return this.db.customerActivity.create({
      data: {
        ...data,
        customerId,
      },
    });
  }
}

export const activityRepository = new ActivityRepository();
export default activityRepository;
