import { Prisma, CustomerStatus, Gender, PriorityLevel } from '@prisma/client';
import BaseRepository from './base.repository.js';

export interface CustomerQueryFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: CustomerStatus;
  product?: string;
  need?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fullName' | 'overallStatus';
  sortOrder?: 'asc' | 'desc';
}

export class CustomerRepository extends BaseRepository {
  async findMany(filters: CustomerQueryFilters) {
    const {
      page,
      pageSize,
      search,
      status,
      product,
      need,
      tag,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;

    const where: Prisma.CustomerWhereInput = {};

    // 1. Search by name or phone
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    // 2. Status filter
    if (status) {
      where.overallStatus = status;
    }

    // 3. Product filter (customer has case for product id or code)
    if (product && product.trim()) {
      where.cases = {
        some: {
          OR: [
            { productId: product },
            { product: { code: product } },
            { product: { name: { contains: product } } },
          ],
        },
      };
    }

    // 4. Need filter
    if (need && need.trim()) {
      where.needs = {
        some: {
          needType: { contains: need.trim() },
        },
      };
    }

    // 5. Tag filter
    if (tag && tag.trim()) {
      where.customerTags = {
        some: {
          OR: [
            { tagId: tag },
            { tag: { name: tag } },
          ],
        },
      };
    }

    // 6. Date Range filter on createdAt
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [total, customers] = await Promise.all([
      this.db.customer.count({ where }),
      this.db.customer.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customerSource: true,
          customerTags: {
            include: { tag: true },
          },
          cases: {
            include: { product: true },
            take: 5,
          },
          needs: {
            select: { id: true, needType: true, status: true },
            take: 5,
          },
          activities: {
            orderBy: { occurredAt: 'desc' },
            take: 1,
          },
          followUps: {
            where: { status: 'PENDING' },
            orderBy: { dueAt: 'asc' },
            take: 1,
          },
          recommendations: {
            where: { status: { in: ['NEW', 'ACTIVE', 'REVIEWED'] } },
            orderBy: [{ score: 'desc' }, { generatedAt: 'desc' }],
            take: 1,
            include: {
              targetProduct: { select: { id: true, code: true, name: true } },
            },
          },
          _count: {
            select: {
              cases: true,
              needs: true,
              activities: true,
              followUps: { where: { status: 'PENDING' } },
            },
          },
        },
      }),
    ]);

    return { total, customers };
  }

  async findById(id: string) {
    return this.db.customer.findUnique({
      where: { id },
      include: {
        customerSource: true,
        customerTags: {
          include: { tag: true },
        },
      },
    });
  }

  async findDetailById(id: string) {
    return this.db.customer.findUnique({
      where: { id },
      include: {
        customerSource: true,
        cases: {
          include: {
            product: true,
            progressHistory: {
              orderBy: { changedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        needs: {
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { occurredAt: 'desc' },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
        customerTags: {
          include: { tag: true },
        },
        followUps: {
          orderBy: { dueAt: 'asc' },
        },
        recommendations: {
          include: { targetProduct: true },
          orderBy: { generatedAt: 'desc' },
        },
        pushRecords: {
          include: {
            targetProduct: true,
            recommendation: true,
          },
          orderBy: { pushedAt: 'desc' },
        },
      },
    });
  }

  async findByPhone(phone: string) {
    return this.db.customer.findFirst({
      where: { phone },
    });
  }

  async create(data: {
    fullName: string;
    phone: string;
    email?: string | null;
    gender?: Gender | null;
    dateOfBirth?: Date | null;
    address?: string | null;
    source?: string | null;
    sourceId?: string | null;
    overallStatus?: CustomerStatus;
    priority?: PriorityLevel | null;
  }) {
    return this.db.customer.create({
      data,
    });
  }

  async update(id: string, data: Prisma.CustomerUpdateInput) {
    return this.db.customer.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.db.customer.delete({
      where: { id },
    });
  }

  async addTag(customerId: string, tagId: string) {
    return this.db.customerTag.upsert({
      where: {
        customerId_tagId: { customerId, tagId },
      },
      create: { customerId, tagId },
      update: {},
      include: { tag: true },
    });
  }

  async removeTag(customerId: string, tagId: string) {
    return this.db.customerTag.delete({
      where: {
        customerId_tagId: { customerId, tagId },
      },
    });
  }
}

export const customerRepository = new CustomerRepository();
export default customerRepository;
