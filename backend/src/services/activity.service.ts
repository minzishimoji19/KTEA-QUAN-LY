import { ActivityType } from '@prisma/client';
import { activityRepository } from '../repositories/activity.repository.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { NotFoundError } from '../utils/errors.js';
import BaseService from './base.service.js';

export class ActivityService extends BaseService {
  async getActivitiesByCustomerId(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }
    return activityRepository.findByCustomerId(customerId);
  }

  async createActivity(customerId: string, data: {
    type: ActivityType;
    title: string;
    description?: string | null;
    occurredAt?: string | Date;
  }) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    const occurredDate = data.occurredAt ? new Date(data.occurredAt) : new Date();

    return activityRepository.create(customerId, {
      type: data.type,
      title: data.title,
      description: data.description,
      occurredAt: occurredDate,
    });
  }
}

export const activityService = new ActivityService();
export default activityService;
