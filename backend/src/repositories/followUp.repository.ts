import { Prisma, FollowUpStatus } from '@prisma/client';
import BaseRepository from './base.repository.js';

export interface ScopedPartnerScheduleFilter {
  userId: string;
  aliases: string[];
  assignmentScope?: 'all' | 'current' | 'historical';
  currentCustomerIds?: string[];
  historicalCustomerIds?: string[];
  allCustomerIds?: string[];
  grantedFollowUpIds?: string[];
  activeGrantedFollowUpIds?: string[];
  historicalGrantedFollowUpIds?: string[];
}

export class FollowUpRepository extends BaseRepository {
  async findAll(
    filter?: 'today' | 'overdue' | 'upcoming' | 'completed' | 'all',
    status?: FollowUpStatus,
    customerId?: string,
    assignedTo?: string,
    scopedCustomerIds?: string[],
    scopedPartner?: ScopedPartnerScheduleFilter
  ) {
    const where: Prisma.FollowUpWhereInput = {};
    const andConditions: Prisma.FollowUpWhereInput[] = [];

    const effectiveCustomerPool = scopedPartner?.allCustomerIds ?? scopedCustomerIds;

    if (effectiveCustomerPool !== undefined) {
      if (customerId) {
        if (!effectiveCustomerPool.includes(customerId)) {
          where.customerId = '__NO_MATCH__';
        } else {
          where.customerId = customerId;
        }
      } else {
        where.customerId = {
          in: effectiveCustomerPool.length > 0 ? effectiveCustomerPool : ['__NO_MATCH__'],
        };
      }
    } else if (customerId) {
      where.customerId = customerId;
    }

    if (scopedPartner) {
      const directOwnerOr: Prisma.FollowUpWhereInput[] = [
        { assignedToUserId: scopedPartner.userId },
      ];
      if (scopedPartner.aliases.length > 0) {
        directOwnerOr.push({
          assignedToUserId: null,
          assignedTo: { in: scopedPartner.aliases },
        });
      }
      const directOwnerCondition: Prisma.FollowUpWhereInput = { OR: directOwnerOr };

      const currentCustIds = scopedPartner.currentCustomerIds || [];
      const activeGrantFuIds = scopedPartner.activeGrantedFollowUpIds || [];
      const currentCondition: Prisma.FollowUpWhereInput = {
        AND: [
          directOwnerCondition,
          {
            OR: [
              { customerId: { in: currentCustIds.length > 0 ? currentCustIds : ['__NO_MATCH__'] } },
              ...(activeGrantFuIds.length > 0 ? [{ id: { in: activeGrantFuIds } }] : []),
            ],
          },
        ],
      };

      const scopeMode = scopedPartner.assignmentScope || 'all';
      if (scopeMode === 'current') {
        andConditions.push(currentCondition);
      } else if (scopeMode === 'historical') {
        const histGrantFuIds = scopedPartner.historicalGrantedFollowUpIds || [];
        const histCustIds = scopedPartner.historicalCustomerIds || [];
        const allGrantFuIds = scopedPartner.grantedFollowUpIds || [];

        const historicalOr: Prisma.FollowUpWhereInput[] = [];
        if (histGrantFuIds.length > 0) {
          historicalOr.push({ id: { in: histGrantFuIds } });
        }
        if (allGrantFuIds.length > 0) {
          historicalOr.push({ id: { in: allGrantFuIds } });
        }
        if (histCustIds.length > 0) {
          historicalOr.push({
            AND: [directOwnerCondition, { customerId: { in: histCustIds } }],
          });
        }

        if (historicalOr.length === 0) {
          andConditions.push({ id: '__NO_MATCH__' });
        } else {
          andConditions.push({
            AND: [{ OR: historicalOr }, { NOT: currentCondition }],
          });
        }
      } else {
        // 'all' = current OR historical schedules belonging to this partner
        const allAllowedOr: Prisma.FollowUpWhereInput[] = [directOwnerCondition];
        if (scopedPartner.grantedFollowUpIds && scopedPartner.grantedFollowUpIds.length > 0) {
          allAllowedOr.push({ id: { in: scopedPartner.grantedFollowUpIds } });
        }
        andConditions.push({ OR: allAllowedOr });
      }
    }

    if (status) {
      where.status = status;
    }

    if (assignedTo && assignedTo.trim()) {
      const trimmed = assignedTo.trim();
      if (trimmed === 'unassigned' || trimmed === 'CHUA_PHAN_CONG') {
        andConditions.push({
          assignedTo: null,
          assignedToUserId: null,
        });
      } else if (trimmed !== 'all') {
        andConditions.push({
          OR: [{ assignedTo: trimmed }, { assignedToUserId: trimmed }],
        });
      }
    }

    if (andConditions.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        ...andConditions,
      ];
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
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  async findById(id: string) {
    return this.db.followUp.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async create(data: {
    customerId: string;
    title: string;
    description?: string | null;
    dueAt: Date;
    status?: FollowUpStatus;
    assignedTo?: string | null;
    assignedToUserId?: string | null;
  }) {
    return this.db.followUp.create({
      data,
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
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
        assignedToUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
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
