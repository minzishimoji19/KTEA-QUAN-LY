import { Prisma, AssignmentSourceType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
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

export interface SyncBulkFollowUpResult {
  isLinked: boolean;
  partnerUserId: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
  grantsCreated: number;
  assignmentsCreated: number;
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
      caregiverUserId?: string | null;
      caregiverName?: string | null;
      assignedById?: string | null;
      previousCaregiverUserId?: string | null;
      previousCaregiverName?: string | null;
    }
  ): Promise<SyncFollowUpResult> {
    const {
      followUpId,
      customerId,
      caregiverUserId,
      caregiverName,
      assignedById,
      previousCaregiverUserId,
      previousCaregiverName,
    } = params;

    // 1. Resolve new caregiver and linked partner user
    let newPartnerUserId: string | null = null;
    let newPartnerName: string | null = null;
    let newPartnerEmail: string | null = null;

    if (caregiverUserId && caregiverUserId.trim()) {
      const user = await tx.user.findUnique({
        where: { id: caregiverUserId.trim() },
      });
      if (user && user.status === 'ACTIVE') {
        if (user.role === 'PARTNER') {
          newPartnerUserId = user.id;
          newPartnerName = user.fullName;
          newPartnerEmail = user.email;
        } else {
          // ADMIN user: has global access, doesn't need partner grant
          newPartnerUserId = null;
          newPartnerName = user.fullName;
          newPartnerEmail = user.email;
        }
      }
    }

    if (!newPartnerUserId && !newPartnerName && caregiverName && caregiverName.trim()) {
      const trimmedCaregiver = caregiverName.trim();
      let caretaker = await tx.caretaker.findUnique({
        where: { id: trimmedCaregiver },
        include: { user: true },
      });
      if (!caretaker) {
        caretaker = await tx.caretaker.findFirst({
          where: { name: trimmedCaregiver },
          include: { user: true },
        });
      }

      if (caretaker?.userId && caretaker.user && caretaker.user.status === 'ACTIVE') {
        if (caretaker.user.role === 'PARTNER') {
          newPartnerUserId = caretaker.userId;
          newPartnerName = caretaker.user.fullName;
          newPartnerEmail = caretaker.user.email;
        } else {
          newPartnerUserId = null;
          newPartnerName = caretaker.user.fullName;
          newPartnerEmail = caretaker.user.email;
        }
      }
    }

    // Resolve previous partner user if provided (for legacy schedules that lacked a grant row)
    let resolvedPrevPartnerUserId: string | null = null;
    if (previousCaregiverUserId && previousCaregiverUserId.trim()) {
      const prevUser = await tx.user.findUnique({
        where: { id: previousCaregiverUserId.trim() },
        select: { id: true, role: true },
      });
      if (prevUser && prevUser.role === 'PARTNER') {
        resolvedPrevPartnerUserId = prevUser.id;
      }
    } else if (previousCaregiverName && previousCaregiverName.trim()) {
      const prevCaretaker = await tx.caretaker.findFirst({
        where: {
          OR: [{ id: previousCaregiverName.trim() }, { name: previousCaregiverName.trim() }],
        },
        include: { user: { select: { id: true, role: true } } },
      });
      if (prevCaretaker?.user && prevCaretaker.user.role === 'PARTNER') {
        resolvedPrevPartnerUserId = prevCaretaker.user.id;
      }
    }

    let unassignedPreviousUserId: string | null = null;
    let retainedAccessForPrevious = false;

    // 2. Deactivate (do NOT hard-delete) previous partner grants for this schedule to preserve history
    const existingGrants = await tx.customerAssignmentGrant.findMany({
      where: {
        customerId,
        sourceId: followUpId,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
      },
    });

    if (
      resolvedPrevPartnerUserId &&
      resolvedPrevPartnerUserId !== newPartnerUserId &&
      !existingGrants.some((eg) => eg.userId === resolvedPrevPartnerUserId)
    ) {
      const createdHistoricalGrant = await tx.customerAssignmentGrant.create({
        data: {
          customerId,
          userId: resolvedPrevPartnerUserId,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: followUpId,
          active: false,
          assignedById: assignedById || null,
          notes: `Lịch sử phân công từ lịch chăm sóc #${followUpId}`,
        },
      });
      existingGrants.push(createdHistoricalGrant);
    }

    for (const eg of existingGrants) {
      if (eg.userId !== newPartnerUserId) {
        if (eg.active) {
          await tx.customerAssignmentGrant.update({
            where: { id: eg.id },
            data: { active: false },
          });
        }

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
   * Synchronizes customer assignments in bulk when multiple care schedules are created.
   * Resolves partner account once and inserts assignment grants & assignments using bulk createMany
   * with skipDuplicates to eliminate N+1 roundtrips and avoid transaction timeouts on cloud databases.
   */
  async syncBulkFollowUpAssignments(
    tx: Prisma.TransactionClient,
    params: {
      followUps: Array<{ followUpId: string; customerId: string }>;
      caregiverUserId?: string | null;
      caregiverName?: string | null;
      assignedById?: string | null;
      partnerUser?: { id: string; fullName: string; email: string } | null;
    }
  ): Promise<SyncBulkFollowUpResult> {
    const { followUps, caregiverUserId, caregiverName, assignedById, partnerUser } = params;

    let newPartnerUserId: string | null = partnerUser?.id || null;
    let newPartnerName: string | null = partnerUser?.fullName || null;
    let newPartnerEmail: string | null = partnerUser?.email || null;

    if (!partnerUser) {
      if (caregiverUserId && caregiverUserId.trim()) {
        const user = await tx.user.findUnique({
          where: { id: caregiverUserId.trim() },
        });
        if (user && user.status === 'ACTIVE') {
          if (user.role === 'PARTNER') {
            newPartnerUserId = user.id;
            newPartnerName = user.fullName;
            newPartnerEmail = user.email;
          } else {
            // ADMIN user: has global access, doesn't need partner grant
            newPartnerUserId = null;
            newPartnerName = user.fullName;
            newPartnerEmail = user.email;
          }
        }
      }

      if (!newPartnerUserId && !newPartnerName && caregiverName && caregiverName.trim()) {
        const trimmedCaregiver = caregiverName.trim();
        let caretaker = await tx.caretaker.findUnique({
          where: { id: trimmedCaregiver },
          include: { user: true },
        });
        if (!caretaker) {
          caretaker = await tx.caretaker.findFirst({
            where: { name: trimmedCaregiver },
            include: { user: true },
          });
        }

        if (caretaker?.userId && caretaker.user && caretaker.user.status === 'ACTIVE') {
          if (caretaker.user.role === 'PARTNER') {
            newPartnerUserId = caretaker.userId;
            newPartnerName = caretaker.user.fullName;
            newPartnerEmail = caretaker.user.email;
          } else {
            newPartnerUserId = null;
            newPartnerName = caretaker.user.fullName;
            newPartnerEmail = caretaker.user.email;
          }
        }
      }
    }

    if (!newPartnerUserId) {
      let notice = '';
      if (newPartnerName) {
        notice = `Lịch chăm sóc được giao cho quản trị viên "${newPartnerName}" (không cần phân công quyền đối tác).`;
      } else if (caregiverName && caregiverName.trim()) {
        notice = `Lịch chăm sóc được giao cho "${caregiverName.trim()}". Người chăm sóc này chưa liên kết tài khoản đối tác nên chưa cấp quyền truy cập khách hàng.`;
      } else {
        notice = 'Lịch chăm sóc chưa phân công người phụ trách.';
      }
      return {
        isLinked: false,
        partnerUserId: null,
        partnerName: newPartnerName,
        partnerEmail: newPartnerEmail,
        grantsCreated: 0,
        assignmentsCreated: 0,
        notice,
      };
    }

    if (!followUps || followUps.length === 0) {
      return {
        isLinked: true,
        partnerUserId: newPartnerUserId,
        partnerName: newPartnerName,
        partnerEmail: newPartnerEmail,
        grantsCreated: 0,
        assignmentsCreated: 0,
        notice: `Đã xử lý 0 lịch chăm sóc cho đối tác ${newPartnerName}.`,
      };
    }

    const BATCH_SIZE = 250;

    // 1. Bulk insert assignment grants (skipDuplicates handles existing grants idempotently)
    const grantsData = followUps.map((item) => ({
      id: randomUUID(),
      customerId: item.customerId,
      userId: newPartnerUserId!,
      sourceType: AssignmentSourceType.CARE_SCHEDULE,
      sourceId: item.followUpId,
      active: true,
      assignedById: assignedById || null,
      notes: `Tự động phát sinh từ lịch chăm sóc #${item.followUpId}`,
    }));

    for (let i = 0; i < grantsData.length; i += BATCH_SIZE) {
      const batch = grantsData.slice(i, i + BATCH_SIZE);
      await tx.customerAssignmentGrant.createMany({
        data: batch,
        skipDuplicates: true,
      });
      await tx.customerAssignmentGrant.updateMany({
        where: {
          userId: newPartnerUserId!,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: { in: batch.map((b) => b.sourceId) },
          active: false,
        },
        data: { active: true },
      });
    }

    // 2. Bulk insert materialized customer assignments for distinct customers
    const distinctCustomerIds = Array.from(new Set(followUps.map((f) => f.customerId)));
    const assignmentsData = distinctCustomerIds.map((customerId) => ({
      id: randomUUID(),
      customerId,
      userId: newPartnerUserId!,
      assignedById: assignedById || null,
      notes: 'Phân công qua lịch chăm sóc',
    }));

    for (let i = 0; i < assignmentsData.length; i += BATCH_SIZE) {
      const batch = assignmentsData.slice(i, i + BATCH_SIZE);
      await tx.customerAssignment.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    return {
      isLinked: true,
      partnerUserId: newPartnerUserId,
      partnerName: newPartnerName,
      partnerEmail: newPartnerEmail,
      grantsCreated: grantsData.length,
      assignmentsCreated: assignmentsData.length,
      notice: `Đã phân công ${distinctCustomerIds.length} khách hàng cho đối tác ${newPartnerName} (${newPartnerEmail}) qua lịch chăm sóc.`,
    };
  }

  /**
   * Revokes assignment grants when a follow-up is cancelled or deleted.
   * Deactivates the grant (`active: false`) to preserve historical assignment visibility.
   * Only revokes customer_assignments if NO remaining valid source grants exist.
   */
  async revokeFollowUpAssignment(
    tx: Prisma.TransactionClient,
    params: {
      followUpId: string;
      customerId: string;
      hardDelete?: boolean;
    }
  ): Promise<{ revokedUserIds: string[]; retainedUserIds: string[] }> {
    const { followUpId, customerId, hardDelete = false } = params;

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
      if (hardDelete) {
        await tx.customerAssignmentGrant.delete({
          where: { id: grant.id },
        });
      } else if (grant.active) {
        await tx.customerAssignmentGrant.update({
          where: { id: grant.id },
          data: { active: false },
        });
      }

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
   * Revokes direct assignment grant from Admin by deactivating (`active: false`) to preserve history.
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

    const existingDirectGrant = await tx.customerAssignmentGrant.findUnique({
      where: {
        customer_user_source_unique: {
          customerId,
          userId,
          sourceType: AssignmentSourceType.DIRECT,
          sourceId: 'DIRECT',
        },
      },
    });

    if (existingDirectGrant) {
      if (existingDirectGrant.active) {
        await tx.customerAssignmentGrant.update({
          where: { id: existingDirectGrant.id },
          data: { active: false },
        });
      }
    } else {
      // Legacy assignment without a grant row: preserve historical evidence before revoking
      const legacyAssignment = await tx.customerAssignment.findUnique({
        where: { customerId_userId: { customerId, userId } },
      });
      if (legacyAssignment) {
        await tx.customerAssignmentGrant.create({
          data: {
            customerId,
            userId,
            sourceType: AssignmentSourceType.DIRECT,
            sourceId: 'DIRECT',
            active: false,
            assignedById: legacyAssignment.assignedById || null,
            notes: legacyAssignment.notes || 'Lịch sử phân công trực tiếp',
          },
        });
      }
    }

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

  /**
   * Revokes care schedule assignment grant(s) for a partner and customer.
   * Safely unassigns open (PENDING/IN_PROGRESS) follow-up task(s) without wiping COMPLETED schedule history.
   * Deactivates (`active: false`) the CARE_SCHEDULE grant(s) to preserve historical visibility.
   * If partner still has other valid sources (e.g. direct assignment), customer_assignments is retained.
   */
  async revokeCareScheduleAssignment(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      userId: string;
      followUpId?: string;
    }
  ): Promise<{ completelyRevoked: boolean; remainingSourcesCount: number }> {
    const { customerId, userId, followUpId } = params;

    // 1. Fetch user and linked caretakers to match by either user.id or caretaker/user name
    const [user, linkedCaretakers] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      }),
      tx.caretaker.findMany({
        where: { userId },
        select: { name: true },
      }),
    ]);

    const nameAliases = Array.from(
      new Set([user?.fullName, ...linkedCaretakers.map((c) => c.name)].filter(Boolean) as string[])
    );

    const whereConditions: Prisma.FollowUpWhereInput[] = [{ assignedToUserId: userId }];
    if (nameAliases.length > 0) {
      whereConditions.push({
        assignedToUserId: null,
        assignedTo: { in: nameAliases },
      });
    }

    // Ensure historical CARE_SCHEDULE grants exist for any matched follow-ups before unassigning
    const matchedFollowUps = await tx.followUp.findMany({
      where: {
        customerId,
        ...(followUpId ? { id: followUpId } : {}),
        OR: whereConditions,
      },
      select: { id: true, status: true },
    });

    for (const fu of matchedFollowUps) {
      await tx.customerAssignmentGrant.upsert({
        where: {
          customer_user_source_unique: {
            customerId,
            userId,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: fu.id,
          },
        },
        create: {
          customerId,
          userId,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: fu.id,
          active: false,
          notes: `Lịch sử phân công từ lịch chăm sóc #${fu.id}`,
        },
        update: {
          active: false,
        },
      });
    }

    // 2. Unassign ONLY non-completed follow-ups; NEVER wipe caregiver on COMPLETED schedules
    await tx.followUp.updateMany({
      where: {
        customerId,
        ...(followUpId ? { id: followUpId } : {}),
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: whereConditions,
      },
      data: {
        assignedToUserId: null,
        assignedTo: null,
      },
    });

    // 3. Deactivate the CARE_SCHEDULE grant(s) (do NOT hard-delete so historical access works)
    await tx.customerAssignmentGrant.updateMany({
      where: {
        customerId,
        userId,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
        ...(followUpId ? { sourceId: followUpId } : {}),
      },
      data: {
        active: false,
      },
    });

    // 4. Count remaining active grants
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

  /**
   * Completely revokes ALL active assignment grants (both DIRECT and CARE_SCHEDULE) for a partner and customer.
   * Safely unassigns open (PENDING/IN_PROGRESS) care schedules while preserving COMPLETED schedules and historical grants (`active: false`).
   * Removes the customer from the partner's active assigned scope (`customer_assignments`).
   */
  async revokeAllAssignments(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      userId: string;
    }
  ): Promise<{ completelyRevoked: boolean; remainingSourcesCount: number }> {
    const { customerId, userId } = params;

    // 1. Fetch user and linked caretakers to match follow-ups by either user.id or name alias
    const [user, linkedCaretakers] = await Promise.all([
      tx.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      }),
      tx.caretaker.findMany({
        where: { userId },
        select: { name: true },
      }),
    ]);

    const nameAliases = Array.from(
      new Set([user?.fullName, ...linkedCaretakers.map((c) => c.name)].filter(Boolean) as string[])
    );

    const whereConditions: Prisma.FollowUpWhereInput[] = [{ assignedToUserId: userId }];
    if (nameAliases.length > 0) {
      whereConditions.push({
        assignedToUserId: null,
        assignedTo: { in: nameAliases },
      });
    }

    // Ensure historical grants exist for any follow-ups of this partner on this customer
    const partnerFollowUps = await tx.followUp.findMany({
      where: {
        customerId,
        OR: whereConditions,
      },
      select: { id: true, status: true },
    });

    for (const fu of partnerFollowUps) {
      await tx.customerAssignmentGrant.upsert({
        where: {
          customer_user_source_unique: {
            customerId,
            userId,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: fu.id,
          },
        },
        create: {
          customerId,
          userId,
          sourceType: AssignmentSourceType.CARE_SCHEDULE,
          sourceId: fu.id,
          active: false,
          notes: `Lịch sử phân công từ lịch chăm sóc #${fu.id}`,
        },
        update: {
          active: false,
        },
      });
    }

    // Ensure historical grant exists if customer had a legacy direct assignment without grants
    const existingGrantsCount = await tx.customerAssignmentGrant.count({
      where: { customerId, userId },
    });
    if (existingGrantsCount === 0) {
      const existingAssign = await tx.customerAssignment.findUnique({
        where: { customerId_userId: { customerId, userId } },
      });
      if (existingAssign) {
        await tx.customerAssignmentGrant.create({
          data: {
            customerId,
            userId,
            sourceType: AssignmentSourceType.DIRECT,
            sourceId: 'DIRECT',
            active: false,
            assignedById: existingAssign.assignedById || null,
            notes: existingAssign.notes || 'Lịch sử phân công trực tiếp',
          },
        });
      }
    }

    // Unassign ONLY open (PENDING/IN_PROGRESS) follow-ups; preserve COMPLETED/CANCELLED caregiver history!
    await tx.followUp.updateMany({
      where: {
        customerId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        OR: whereConditions,
      },
      data: {
        assignedToUserId: null,
        assignedTo: null,
      },
    });

    // 2. Deactivate all grants for this customer and partner (preserving historical records)
    await tx.customerAssignmentGrant.updateMany({
      where: {
        customerId,
        userId,
      },
      data: {
        active: false,
      },
    });

    // 3. Delete active customer_assignment row
    await tx.customerAssignment.deleteMany({
      where: {
        customerId,
        userId,
      },
    });

    return { completelyRevoked: true, remainingSourcesCount: 0 };
  }

  /**
   * Backfills all historical care schedules for a specific Caregiver to their linked PARTNER account.
   * Processes records in safe batches to prevent transaction timeouts and locks on Cloud MySQL.
   * Fully idempotent: can be safely executed repeatedly without creating duplicates.
   */
  async backfillCaregiverSchedules(
    db: Prisma.TransactionClient | PrismaClient,
    params: {
      caretakerName: string;
      userId: string;
      assignedById?: string;
    }
  ): Promise<{
    caretakerName: string;
    userId: string;
    totalSchedules: number;
    distinctCustomers: number;
    grantsProcessed: number;
    assignmentsCreated: number;
  }> {
    const { caretakerName, userId, assignedById } = params;
    const trimmedName = caretakerName.trim();

    // 1. Fetch all active schedules associated with this caregiver name
    const schedules = await db.followUp.findMany({
      where: {
        assignedTo: trimmedName,
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        customerId: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const distinctCustomerIds = Array.from(new Set(schedules.map((s: any) => s.customerId)));

    let grantsProcessed = 0;
    let assignmentsCreated = 0;

    // 2. Process in chunks of 25 to respect Aiven connection limits
    const CHUNK_SIZE = 25;
    for (let i = 0; i < schedules.length; i += CHUNK_SIZE) {
      const chunk = schedules.slice(i, i + CHUNK_SIZE);

      for (const schedule of chunk) {
        // Upsert grant for each schedule
        await db.customerAssignmentGrant.upsert({
          where: {
            customer_user_source_unique: {
              customerId: schedule.customerId,
              userId,
              sourceType: AssignmentSourceType.CARE_SCHEDULE,
              sourceId: schedule.id,
            },
          },
          create: {
            customerId: schedule.customerId,
            userId,
            sourceType: AssignmentSourceType.CARE_SCHEDULE,
            sourceId: schedule.id,
            active: true,
            assignedById: assignedById || null,
            notes: `Đồng bộ từ lịch sử chăm sóc #${schedule.id} (${trimmedName})`,
          },
          update: {
            active: true,
            assignedById: assignedById || undefined,
            notes: `Đồng bộ từ lịch sử chăm sóc #${schedule.id} (${trimmedName})`,
          },
        });
        grantsProcessed++;
      }
    }

    // 3. Ensure materialized assignment exists for each distinct customer
    for (const customerId of distinctCustomerIds) {
      const existingAssignment = await db.customerAssignment.findUnique({
        where: {
          customerId_userId: { customerId, userId },
        },
      });

      if (!existingAssignment) {
        await db.customerAssignment.create({
          data: {
            customerId,
            userId,
            assignedById: assignedById || null,
            notes: `Đồng bộ từ người chăm sóc ${trimmedName}`,
          },
        });
        assignmentsCreated++;
      }
    }

    return {
      caretakerName: trimmedName,
      userId,
      totalSchedules: schedules.length,
      distinctCustomers: distinctCustomerIds.length,
      grantsProcessed,
      assignmentsCreated,
    };
  }

  /**
   * Revokes all schedule-based grants for a user when unlinking from a Caregiver.
   * Safely retains customer_assignments if other sources (e.g. DIRECT or other schedule) exist.
   */
  async revokeCaregiverSchedules(
    db: Prisma.TransactionClient | PrismaClient,
    params: {
      caretakerName: string;
      userId: string;
    }
  ): Promise<{
    caretakerName: string;
    userId: string;
    grantsRevoked: number;
    assignmentsCompletelyRemoved: number;
    assignmentsRetained: number;
  }> {
    const { caretakerName, userId } = params;
    const trimmedName = caretakerName.trim();

    // 1. Find all schedule IDs for this caregiver
    const schedules = await db.followUp.findMany({
      where: {
        assignedTo: trimmedName,
      },
      select: { id: true, customerId: true },
    });

    const scheduleIds = schedules.map((s: any) => s.id);
    const affectedCustomerIds = Array.from(new Set(schedules.map((s: any) => s.customerId)));

    if (scheduleIds.length === 0) {
      return {
        caretakerName: trimmedName,
        userId,
        grantsRevoked: 0,
        assignmentsCompletelyRemoved: 0,
        assignmentsRetained: 0,
      };
    }

    // 2. Deactivate grants originating from these schedules for this user (preserving history)
    const updateResult = await db.customerAssignmentGrant.updateMany({
      where: {
        userId,
        sourceType: AssignmentSourceType.CARE_SCHEDULE,
        sourceId: { in: scheduleIds },
        active: true,
      },
      data: {
        active: false,
      },
    });

    let assignmentsCompletelyRemoved = 0;
    let assignmentsRetained = 0;

    // 3. For each affected customer, check remaining active grants
    for (const customerId of affectedCustomerIds) {
      const remainingCount = await db.customerAssignmentGrant.count({
        where: {
          customerId,
          userId,
          active: true,
        },
      });

      if (remainingCount === 0) {
        await db.customerAssignment.deleteMany({
          where: { customerId, userId },
        });
        assignmentsCompletelyRemoved++;
      } else {
        assignmentsRetained++;
      }
    }

    return {
      caretakerName: trimmedName,
      userId,
      grantsRevoked: updateResult.count,
      assignmentsCompletelyRemoved,
      assignmentsRetained,
    };
  }
}

export const assignmentSyncService = new AssignmentSyncService();
export default assignmentSyncService;

