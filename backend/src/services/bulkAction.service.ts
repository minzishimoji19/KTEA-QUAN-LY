import prisma from '../config/database.js';
import { tagRepository } from '../repositories/tag.repository.js';
import { customerSourceRepository } from '../repositories/customerSource.repository.js';
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
    failedCount?: number;
    failedDetails?: Array<{ id: string; name?: string; reason: string }>;
  }> {
    const { action, customerIds } = input;

    if (!customerIds || customerIds.length === 0) {
      throw new BadRequestError('Không có danh sách khách hàng được cung cấp');
    }

    // Deduplicate customer IDs to prevent duplicate processing
    const uniqueCustomerIds = Array.from(new Set(customerIds));

    // Validate that all provided customer IDs actually exist
    const existingCount = await prisma.customer.count({
      where: { id: { in: uniqueCustomerIds } },
    });

    if (existingCount !== uniqueCustomerIds.length) {
      throw new NotFoundError(
        `Một số khách hàng không tồn tại. Yêu cầu: ${uniqueCustomerIds.length}, tìm thấy: ${existingCount}.`
      );
    }

    switch (action) {
      case 'UPDATE_STATUS':
        return this.bulkUpdateStatus(uniqueCustomerIds, input.payload.status);
      case 'UPDATE_PRIORITY':
        return this.bulkUpdatePriority(uniqueCustomerIds, input.payload.priority);
      case 'ADD_TAG':
        return this.bulkAddTag(uniqueCustomerIds, input.payload.tagId);
      case 'ASSIGN_SOURCE':
        return this.bulkAssignSource(uniqueCustomerIds, input.payload.sourceId);
      case 'DELETE_CUSTOMERS':
        return this.bulkDeleteCustomers(uniqueCustomerIds);
      default:
        throw new BadRequestError(`Thao tác hàng loạt không được hỗ trợ`);
    }
  }

  private async bulkUpdateStatus(
    customerIds: string[],
    status: string
  ) {
    const BATCH_SIZE = 250;
    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { overallStatus: status as any },
      });

      // Log bulk activity for each customer in batches
      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);
        await tx.customerActivity.createMany({
          data: batch.map((customerId) => ({
            customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Cập nhật trạng thái (Hàng loạt)',
            description: `Trạng thái khách hàng được cập nhật thành "${status}" thông qua thao tác hàng loạt.`,
          })),
        });
      }
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
    const BATCH_SIZE = 250;
    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: { priority: priority as any },
      });

      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);
        await tx.customerActivity.createMany({
          data: batch.map((customerId) => ({
            customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Cập nhật mức độ nhu cầu (Hàng loạt)',
            description: `Mức độ nhu cầu khách hàng được cập nhật thành "${priority}" thông qua thao tác hàng loạt.`,
          })),
        });
      }
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

    const BATCH_SIZE = 250;

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);

        // Bulk insert CustomerTag with skipDuplicates to ensure idempotency and prevent duplicate records
        await tx.customerTag.createMany({
          data: batch.map((customerId) => ({
            customerId,
            tagId,
          })),
          skipDuplicates: true,
        });

        // Log bulk activity for each customer in batch
        await tx.customerActivity.createMany({
          data: batch.map((customerId) => ({
            customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Gắn nhãn (Hàng loạt)',
            description: `Tag "${tag.name}" được gắn thông qua thao tác hàng loạt.`,
          })),
        });
      }
    });

    return {
      affected: customerIds.length,
      action: 'ADD_TAG',
      customerIds,
    };
  }

  private async bulkAssignSource(customerIds: string[], sourceId: string) {
    const source = await customerSourceRepository.findById(sourceId);
    if (!source) {
      throw new NotFoundError(`Nguồn khách hàng với ID '${sourceId}' không tồn tại`);
    }
    if (!source.active) {
      throw new BadRequestError(`Nguồn khách hàng '${source.name}' đã ngưng hoạt động và không thể gán`);
    }

    const BATCH_SIZE = 250;

    await prisma.$transaction(async (tx) => {
      await tx.customer.updateMany({
        where: { id: { in: customerIds } },
        data: {
          sourceId: source.id,
          source: source.name,
        },
      });

      for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
        const batch = customerIds.slice(i, i + BATCH_SIZE);
        await tx.customerActivity.createMany({
          data: batch.map((customerId) => ({
            customerId,
            type: ActivityType.SYSTEM_EVENT,
            title: 'Gán nguồn khách hàng (Hàng loạt)',
            description: `Nguồn khách hàng được gán thành "${source.name}" thông qua thao tác hàng loạt.`,
          })),
        });
      }
    });

    return {
      affected: customerIds.length,
      action: 'ASSIGN_SOURCE',
      customerIds,
    };
  }

  private async bulkDeleteCustomers(customerIds: string[]) {
    // Check relations and protect business data
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      include: {
        _count: {
          select: {
            cases: true,
            notes: true,
            followUps: true,
            pushRecords: true,
          },
        },
      },
    });

    const deletableIds: string[] = [];
    const failedDetails: Array<{ id: string; name?: string; reason: string }> = [];

    for (const customer of customers) {
      const reasons: string[] = [];
      if (customer._count.cases > 0) {
        reasons.push(`có ${customer._count.cases} hồ sơ vay đang lưu trữ`);
      }
      if (customer._count.notes > 0) {
        reasons.push(`có ${customer._count.notes} ghi chú nghiệp vụ`);
      }
      if (customer._count.followUps > 0) {
        reasons.push(`có ${customer._count.followUps} lịch chăm sóc`);
      }
      if (customer._count.pushRecords > 0) {
        reasons.push(`có ${customer._count.pushRecords} lịch sử chuyển khách`);
      }

      if (reasons.length > 0) {
        failedDetails.push({
          id: customer.id,
          name: customer.fullName,
          reason: `Không thể xóa vì ${reasons.join(', ')}.`,
        });
      } else {
        deletableIds.push(customer.id);
      }
    }

    if (deletableIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        // Clean auxiliary relations first for data consistency
        await tx.customerTag.deleteMany({ where: { customerId: { in: deletableIds } } });
        await tx.customerActivity.deleteMany({ where: { customerId: { in: deletableIds } } });
        await tx.customerNeed.deleteMany({ where: { customerId: { in: deletableIds } } });
        await tx.recommendation.deleteMany({ where: { customerId: { in: deletableIds } } });
        await tx.customer.deleteMany({
          where: { id: { in: deletableIds } },
        });
      });
    }

    return {
      affected: deletableIds.length,
      action: 'DELETE_CUSTOMERS',
      customerIds: deletableIds,
      failedCount: failedDetails.length,
      failedDetails,
    };
  }
}

export const bulkActionService = new BulkActionService();
export default bulkActionService;
