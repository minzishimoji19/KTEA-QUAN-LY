import { Prisma, CustomerStatus, CaseProgress, Gender, PriorityLevel } from '@prisma/client';
import BaseRepository from './base.repository.js';

export interface CustomerQueryFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CustomerStatus | CaseProgress | string;
  priority?: PriorityLevel;
  sourceId?: string;
  product?: string;
  need?: string;
  tag?: string;
  surveyStatus?: 'NOT_CREATED' | 'SENT' | 'COMPLETED' | 'all' | string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'fullName' | 'overallStatus';
  sortOrder?: 'asc' | 'desc';
  scopedCustomerIds?: string[];
  scopedUserId?: string;
  selectedIds?: string[];
}

export class CustomerRepository extends BaseRepository {
  async findMany(filters: CustomerQueryFilters) {
    const {
      page,
      pageSize,
      search,
      status,
      priority,
      sourceId,
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

    // 2. Status filter: sync customer status with latest case progress
    if (status) {
      const isCaseProgress = Object.values(CaseProgress).includes(status as CaseProgress);
      const isCustomerStatus = Object.values(CustomerStatus).includes(status as CustomerStatus);

      if (isCaseProgress) {
        // Query customers whose latest case (by createdAt desc, id desc) matches progress
        const matching = await this.db.$queryRaw<{ customer_id: string }[]>`
          SELECT c.id as customer_id
          FROM customers c
          JOIN customer_cases cc ON cc.id = (
            SELECT id FROM customer_cases
            WHERE customer_id = c.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          )
          WHERE cc.progress = ${status}
        `;
        const customerIds = matching.map((m) => m.customer_id);
        where.id = { in: customerIds.length > 0 ? customerIds : ['__none__'] };
      } else if (isCustomerStatus) {
        // Customers who have no cases and their overallStatus equals the requested status
        const matching = await this.db.$queryRaw<{ customer_id: string }[]>`
          SELECT c.id as customer_id
          FROM customers c
          WHERE c.overall_status = ${status}
          AND NOT EXISTS (
            SELECT 1 FROM customer_cases WHERE customer_id = c.id
          )
        `;
        const customerIds = matching.map((m) => m.customer_id);
        where.id = { in: customerIds.length > 0 ? customerIds : ['__none__'] };
      } else {
        where.overallStatus = status as any;
      }
    }

    // 2b. Priority filter
    if (priority) {
      where.priority = priority;
    }

    // 2c. Source filter
    if (sourceId) {
      where.sourceId = sourceId;
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

    // 5b. Survey status filter (computed from real Assessment + PublicSurveyLink records)
    if (filters.surveyStatus && filters.surveyStatus !== 'all') {
      const now = new Date();
      if (filters.surveyStatus === 'COMPLETED') {
        where.assessments = {
          some: {
            status: 'COMPLETED',
          },
        };
      } else if (filters.surveyStatus === 'SENT') {
        const sentConditions: Prisma.CustomerWhereInput[] = [
          { assessments: { none: { status: 'COMPLETED' } } },
          {
            assessments: {
              some: {
                status: { not: 'CANCELLED' },
                publicSurveyLink: {
                  status: 'ACTIVE',
                  revokedAt: null,
                  expiresAt: { gt: now },
                },
              },
            },
          },
        ];
        where.AND = Array.isArray(where.AND)
          ? [...where.AND, ...sentConditions]
          : where.AND
          ? [where.AND, ...sentConditions]
          : sentConditions;
      } else if (filters.surveyStatus === 'NOT_CREATED') {
        const notCreatedConditions: Prisma.CustomerWhereInput[] = [
          { assessments: { none: { status: 'COMPLETED' } } },
          {
            assessments: {
              none: {
                status: { not: 'CANCELLED' },
                publicSurveyLink: {
                  status: 'ACTIVE',
                  revokedAt: null,
                  expiresAt: { gt: now },
                },
              },
            },
          },
        ];
        where.AND = Array.isArray(where.AND)
          ? [...where.AND, ...notCreatedConditions]
          : where.AND
          ? [where.AND, ...notCreatedConditions]
          : notCreatedConditions;
      }
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

    // Enforce RBAC scoped access for Partner
    if (filters.scopedCustomerIds) {
      const allowedSet = new Set(filters.scopedCustomerIds);
      if (where.id && typeof where.id === 'object' && 'in' in where.id && Array.isArray((where.id as any).in)) {
        const intersected = ((where.id as any).in as string[]).filter((id) => allowedSet.has(id));
        where.id = { in: intersected.length > 0 ? intersected : ['__none__'] };
      } else {
        where.id = { in: filters.scopedCustomerIds.length > 0 ? filters.scopedCustomerIds : ['__none__'] };
      }
    }

    // Filter by selectedIds if provided
    if (filters.selectedIds && filters.selectedIds.length > 0) {
      const selectedSet = new Set(filters.selectedIds);
      if (where.id && typeof where.id === 'object' && 'in' in where.id && Array.isArray((where.id as any).in)) {
        const intersected = ((where.id as any).in as string[]).filter((id) => selectedSet.has(id));
        where.id = { in: intersected.length > 0 ? intersected : ['__none__'] };
      } else {
        where.id = { in: filters.selectedIds };
      }
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.max(1, Number(pageSize) || 10);
    const skip = (pageNum - 1) * pageSizeNum;
    const take = pageSizeNum;
    const sortField = sortBy || 'createdAt';
    const sortDirection = sortOrder || 'desc';

    const [total, customers] = await Promise.all([
      this.db.customer.count({ where }),
      this.db.customer.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: sortDirection },
        include: {
          customerSource: true,
          customerTags: {
            include: { tag: true },
          },
          assignments: {
            ...(filters.scopedUserId ? { where: { userId: filters.scopedUserId } } : {}),
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                  status: true,
                },
              },
            },
            orderBy: { assignedAt: 'asc' },
          },
          cases: {
            include: { product: true },
            orderBy: [
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            take: 10,
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
            ...(filters.scopedUserId
              ? {
                  where: {
                    OR: [
                      { assignedToUserId: filters.scopedUserId },
                      { assignedToUserId: null },
                    ],
                  },
                }
              : {}),
            orderBy: [
              { dueAt: 'desc' },
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            take: 10,
            select: {
              id: true,
              title: true,
              status: true,
              dueAt: true,
              completedAt: true,
              updatedAt: true,
              assignedTo: true,
              assignedToUserId: true,
            },
          },
          assessments: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              startedAt: true,
              completedAt: true,
              updatedAt: true,
              _count: {
                select: { answers: true },
              },
              publicSurveyLink: {
                select: {
                  id: true,
                  status: true,
                  expiresAt: true,
                  revokedAt: true,
                  completedAt: true,
                  lastAccessedAt: true,
                  createdAt: true,
                },
              },
            },
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
              followUps: { where: { status: { not: 'CANCELLED' } } },
            },
          },
        },
      }),
    ]);

    return { total, customers };
  }

  async findById(id: string, scopedUserId?: string) {
    return this.db.customer.findUnique({
      where: { id },
      include: {
        customerSource: true,
        customerTags: {
          include: { tag: true },
        },
        assignments: {
          ...(scopedUserId ? { where: { userId: scopedUserId } } : {}),
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        cases: {
          include: { product: true },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        },
        followUps: {
          ...(scopedUserId
            ? {
                where: {
                  OR: [
                    { assignedToUserId: scopedUserId },
                    { assignedToUserId: null },
                  ],
                },
              }
            : {}),
          orderBy: [
            { dueAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            completedAt: true,
            updatedAt: true,
            assignedTo: true,
            assignedToUserId: true,
          },
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            updatedAt: true,
            _count: {
              select: { answers: true },
            },
            publicSurveyLink: {
              select: {
                id: true,
                status: true,
                expiresAt: true,
                revokedAt: true,
                completedAt: true,
                lastAccessedAt: true,
                createdAt: true,
              },
            },
          },
        },
        _count: {
          select: {
            cases: true,
            needs: true,
            activities: true,
            followUps: { where: { status: { not: 'CANCELLED' } } },
          },
        },
      },
    });
  }

  async findDetailById(id: string, scopedUserId?: string) {
    return this.db.customer.findUnique({
      where: { id },
      include: {
        customerSource: true,
        assignments: {
          ...(scopedUserId ? { where: { userId: scopedUserId } } : {}),
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' },
        },
        cases: {
          include: {
            product: true,
            progressHistory: {
              orderBy: { changedAt: 'asc' },
            },
          },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
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
          ...(scopedUserId
            ? {
                where: {
                  OR: [
                    { assignedToUserId: scopedUserId },
                    { assignedToUserId: null },
                  ],
                },
              }
            : {}),
          orderBy: { dueAt: 'asc' },
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            updatedAt: true,
            _count: {
              select: { answers: true },
            },
            publicSurveyLink: {
              select: {
                id: true,
                status: true,
                expiresAt: true,
                revokedAt: true,
                completedAt: true,
                lastAccessedAt: true,
                createdAt: true,
              },
            },
          },
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
    note?: string | null;
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
