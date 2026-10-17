import prisma from '../config/database.js';

export interface CreateAuditLogParams {
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
}

export class AuditLogService {
  async log(params: CreateAuditLogParams): Promise<void> {
    try {
      const detailsStr =
        typeof params.details === 'object'
          ? JSON.stringify(params.details)
          : params.details;

      await prisma.auditLog.create({
        data: {
          actorId: params.actorId || null,
          actorEmail: params.actorEmail || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId || null,
          details: detailsStr || null,
          ipAddress: params.ipAddress || null,
        },
      });
    } catch (err) {
      // Non-blocking: audit logging error should not crash primary business logic
      console.error('[AuditLog] Failed to record audit log:', err);
    }
  }

  async logAction(
    actorId: string | undefined,
    action: string,
    entityType: string,
    entityId?: string,
    details?: Record<string, unknown> | string,
    ipAddress?: string
  ): Promise<void> {
    return this.log({ actorId, action, entityType, entityId, details, ipAddress });
  }

  async getLogs(filters: {
    limit?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
  }) {
    const limit = Math.min(filters.limit || 50, 200);
    return prisma.auditLog.findMany({
      where: {
        action: filters.action,
        entityType: filters.entityType,
        actorId: filters.actorId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { id: true, email: true, fullName: true, role: true },
        },
      },
    });
  }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
