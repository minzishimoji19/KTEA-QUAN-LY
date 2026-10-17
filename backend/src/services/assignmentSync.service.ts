import { Prisma, AssignmentSourceType } from '@prisma/client';
import { auditLogService } from './auditLog.service.js';

export interface SyncFollowUpResult {
  isLinked: boolean;
  partnerUserId: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
  unassignedPreviousUserId: string | null;
  retainedAccessForPrevious: boolean;
  notice: string;
}

export class AssignmentSyncService {
  /**
   * Synchronizes customer assignments when a care schedule (follow-up) is created or modified.
   * Runs sequentially inside an existing database transaction client (tx) to prevent connection contention.
   */
  async syncFollowUpAssignment(
    tx: Prisma.TransactionClient,
    params: {
      followUpId: string;
      customerId: string;
      caregiverName?: string | null;
      assignedById?: string | null;
      previousCaregiverName?: string | null;
    }
  ): Promise<SyncFollowUpResult> {
    const { followUpId, customerId, caregiverName, assignedById, previousCaregiverName } = params;

    // 1. Resolve new caregiver and linked partner user
    let newPartnerUserId: string | null = null;
    let newPartnerName: string | null = null;
    let newPartnerEmail: string | null = null;

    if (caregiverName && caregiverName.trim()) {
      const trimmedCaregiver = caregiverName.trim();
      const caretaker = await tx.caretaker.findFirst({
        where: { name: trimmedCaregiver },
        include: { user: true },
      });

      if (caretaker?.userId && caretaker.user && caretaker.user.status === 'ACTIVE') {
        newPartnerUserId = caretaker.userId;
        newPartnerName = caretaker.user.fullName;
        newPartnerEmail = caretaker.user.email;
      }
    }

    let unassignedPreviousUserId: string | null = null;
    let retainedAccessForPrevious = false;

    // 2. Handle previous partner grant cleanup directly from existing grants for this schedule
    const existingGrants = await tx.customerAssignmentGrant.findMany({
      where: {
        customerId,
        sourceId: followUpId,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
      },
    });

    for (const eg of existingGrants) {
      if (eg.userId !== newPartnerUserId) {
        await tx.customerAssignmentGrant.delete({
          where: { id: eg.id },
        });

        const remainingGrantsCount = await tx.customerAssignmentGrant.count({
          where: {
            customerId,
            userId: eg.userId,
            active: true,
          },
        });

        if (remainingGrantsCount === 0) {
          await tx.customerAssignment.deleteMany({
            where: {
              customerId,
              userId: eg.userId,
            },
          });
          unassignedPreviousUserId = eg.userId;
        } else {
          retainedAccessForPrevious = true;
        }
      }
    }

    // 4. Process new caregiver assignment (if linked to an active partner)
    if (newPartnerUserId) {
      // Upsert the specific CARE_SCHEDULE grant
      await tx.customerAssignmentGrant.upsert({
        where: {
          customer_user_source_unique: {
            customerId,
            userId: newPartnerUserId,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: followUpId,
          },
        },
        create: {
          customerId,
          userId: newPartnerUserId,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: followUpId,
          active: true,
          assignedById: assignedById || null,
          notes: `Tự động phát sinh từ lịch chăm sóc #${followUpId}`,
        },
        update: {
          active: true,
          assignedById: assignedById || undefined,
          notes: `Tự động phát sinh từ lịch chăm sóc #${followUpId}`,
        },
      });

      // Ensure materialized assignment exists in customer_assignments
      await tx.customerAssignment.upsert({
        where: {
          customerId_userId: {
            customerId,
            userId: newPartnerUserId,
          },
        },
        create: {
          customerId,
          userId: newPartnerUserId,
          assignedById: assignedById || null,
          notes: 'Phân công qua lịch chăm sóc',
        },
        update: {
          // Do not overwrite notes if already set directly by Admin
        },
      });
    }

    let notice = '';
    if (newPartnerUserId) {
      notice = `Đã phân công khách hàng cho đối tác ${newPartnerName} (${newPartnerEmail}) qua lịch chăm sóc.`;
    } else if (caregiverName && caregiverName.trim()) {
      notice = `Lịch chăm sóc được giao cho "${caregiverName.trim()}". Người chăm sóc này chưa liên kết tài khoản đối tác nên chưa cấp quyền truy cập khách hàng.`;
    } else {
      notice = 'Lịch chăm sóc chưa phân công người phụ trách.';
    }

    return {
      isLinked: Boolean(newPartnerUserId),
      partnerUserId: newPartnerUserId,
      partnerName: newPartnerName,
      partnerEmail: newPartnerEmail,
      unassignedPreviousUserId,
      retainedAccessForPrevious,
      notice,
    };
  }

  /**
   * Revokes assignment grants when a follow-up is cancelled or deleted.
   * Only revokes customer_assignments if NO remaining valid source grants exist.
   */
  async revokeFollowUpAssignment(
    tx: Prisma.TransactionClient,
    params: {
      followUpId: string;
      customerId: string;
    }
  ): Promise<{ revokedUserIds: string[]; retainedUserIds: string[] }> {
    const { followUpId, customerId } = params;

    // Find all grants generated by this care schedule
    const grants = await tx.customerAssignmentGrant.findMany({
      where: {
        customerId,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
        sourceId: followUpId,
      },
    });

    const revokedUserIds: string[] = [];
    const retainedUserIds: string[] = [];

    for (const grant of grants) {
      // Delete the grant
      await tx.customerAssignmentGrant.delete({
        where: { id: grant.id },
      });

      // Check remaining valid grants for this partner on this customer
      const remainingCount = await tx.customerAssignmentGrant.count({
        where: {
          customerId,
          userId: grant.userId,
          active: true,
        },
      });

      if (remainingCount === 0) {
        await tx.customerAssignment.deleteMany({
          where: {
            customerId,
            userId: grant.userId,
          },
        });
        revokedUserIds.push(grant.userId);
      } else {
        retainedUserIds.push(grant.userId);
      }
    }

    return { revokedUserIds, retainedUserIds };
  }

  /**
   * Records direct assignment grant from Admin.
   */
  async recordDirectAssignment(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      userId: string;
      assignedById: string;
      notes?: string;
    }
  ): Promise<void> {
    const { customerId, userId, assignedById, notes } = params;

    await tx.customerAssignmentGrant.upsert({
      where: {
        customer_user_source_unique: {
          customerId,
          userId,
          sourceType: AssignmentSourceType.DIRECT,
          sourceId: 'DIRECT',
        },
      },
      create: {
        customerId,
        userId,
        sourceType: AssignmentSourceType.DIRECT,
        sourceId: 'DIRECT',
        active: true,
        assignedById,
        notes: notes || null,
      },
      update: {
        active: true,
        assignedById,
        notes: notes || undefined,
      },
    });

    await tx.customerAssignment.upsert({
      where: {
        customerId_userId: {
          customerId,
          userId,
        },
      },
      create: {
        customerId,
        userId,
        assignedById,
        notes: notes || null,
      },
      update: {
        assignedById,
        notes: notes || undefined,
        assignedAt: new Date(),
      },
    });
  }

  /**
   * Revokes direct assignment grant from Admin.
   * If partner still has other valid sources (e.g. active care schedules), customer_assignments is retained!
   */
  async revokeDirectAssignment(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      userId: string;
    }
  ): Promise<{ completelyRevoked: boolean; remainingSourcesCount: number }> {
    const { customerId, userId } = params;

    await tx.customerAssignmentGrant.deleteMany({
      where: {
        customerId,
        userId,
        sourceType: AssignmentSourceType.DIRECT,
        sourceId: 'DIRECT',
      },
    });

    const remainingSourcesCount = await tx.customerAssignmentGrant.count({
      where: {
        customerId,
        userId,
        active: true,
      },
    });

    if (remainingSourcesCount === 0) {
      await tx.customerAssignment.deleteMany({
        where: { customerId, userId },
      });
      return { completelyRevoked: true, remainingSourcesCount: 0 };
    }

    return { completelyRevoked: false, remainingSourcesCount };
  }
}

export const assignmentSyncService = new AssignmentSyncService();
export default assignmentSyncService;
