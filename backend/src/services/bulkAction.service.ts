import prisma from '../config/database.js';
import { tagRepository } from '../repositories/tag.repository.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { BulkActionInput } from '../validations/bulkAction.validation.js';
import { ActivityType } from '@prisma/client';

export class BulkActionService {
  /**
   * Execute a bulk action on a set of customer IDs.
   * All operations are wrapped in a single Prisma transaction for atomicity.
   */
  async execute(input: BulkActionInput): Promise<{
    affected: number;
    action: string;
    customerIds: string[];
  }> {
    const { action, customerIds } = input;

    if (customerIds.length === 0) {
      throw new BadRequestError('No customer IDs provided');
    }

    // Validate that all provided customer IDs actually exist
    const existingCount = await prisma.customer.count({
      where: { id: { in: customerIds } },
    });

    if (existingCount !== customerIds.length) {
      throw new NotFoundError(
        `Some customer IDs do not exist. Expected ${customerIds.length}, found ${existingCount}.`
      );
    }

    switch (action) {
      case 'UPDATE_STATUS':
        return this.bulkUpdateStatus(customerIds, input.payload.status);
      case 'UPDATE_PRIORITY':
        return this.bulkUpdatePriority(customerIds, input.payload.priority);
      case 'ADD_TAG':
        return this.bulkAddTag(customerIds, input.payload.tagId);
      default:
        throw new BadRequestError(`Unsupported bulk action`);
    }
  }

  private async bulkUpdateStatus(
    customerIds: string[],
    status: string
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { overallStatus: status as any },
      });

      // Log bulk activity for each customer
      await tx.customerActivity.createMany({
        data: customerIds.map((customerId) => ({
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Cập nhật trạng thái (Hàng loạt)',
          description: `Trạng thái khách hàng được cập nhật thành "${status}" thông qua thao tác hàng loạt.`,
        })),
      });
    });

    return {
      affected: customerIds.length,
      action: 'UPDATE_STATUS',
      customerIds,
    };
  }

  private async bulkUpdatePriority(
    customerIds: string[],
    priority: string
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { priority: priority as any },
      });

      await tx.customerActivity.createMany({
        data: customerIds.map((customerId) => ({
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Cập nhật mức độ nhu cầu (Hàng loạt)',
          description: `Mức độ nhu cầu khách hàng được cập nhật thành "${priority}" thông qua thao tác hàng loạt.`,
        })),
      });
    });

    return {
      affected: customerIds.length,
      action: 'UPDATE_PRIORITY',
      customerIds,
    };
  }

  private async bulkAddTag(customerIds: string[], tagId: string) {
    // Validate tag exists
    const tag = await tagRepository.findById(tagId);
    if (!tag) {
      throw new NotFoundError(`Tag with ID '${tagId}' not found`);
    }

    await prisma.$transaction(async (tx) => {
      // Use upsert for each customer to ensure idempotency (no duplicate tags)
      for (const customerId of customerIds) {
        await tx.customerTag.upsert({
          where: { customerId_tagId: { customerId, tagId } },
          create: { customerId, tagId },
          update: {},
        });
      }

      // Log bulk activity
      await tx.customerActivity.createMany({
        data: customerIds.map((customerId) => ({
          customerId,
          type: ActivityType.SYSTEM_EVENT,
          title: 'Gắn tag (Hàng loạt)',
          description: `Tag "${tag.name}" được gắn thông qua thao tác hàng loạt.`,
        })),
      });
    });

    return {
      affected: customerIds.length,
      action: 'ADD_TAG',
      customerIds,
    };
  }
}

export const bulkActionService = new BulkActionService();
export default bulkActionService;
