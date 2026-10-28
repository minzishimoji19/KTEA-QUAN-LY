import { Request, Response, NextFunction } from 'express';
import { followUpService } from '../services/followUp.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { FollowUpStatus, Role } from '@prisma/client';
import { customerAccessService } from '../services/customerAccess.service.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../utils/errors.js';
import prisma from '../config/database.js';
import { ScopedPartnerScheduleFilter } from '../repositories/followUp.repository.js';

export const getFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter = req.query.filter as 'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | undefined;
    const status = req.query.status as FollowUpStatus | undefined;
    const customerId = req.query.customerId as string | undefined;
    const assignedTo = (req.query.assignedToUserId || req.query.assignedTo) as string | undefined;

    let scopedCustomerIds: string[] | undefined;
    let scopedPartner: ScopedPartnerScheduleFilter | undefined;

    if (req.user && req.user.role === Role.PARTNER) {
      const [assignedIds, partnerScope] = await Promise.all([
        customerAccessService.getAssignedCustomerIds(req.user.userId),
        customerAccessService.getPartnerCaregiverScope(req.user.userId),
      ]);
      scopedCustomerIds = assignedIds;
      scopedPartner = {
        userId: req.user.userId,
        aliases: partnerScope.aliases,
      };
      if (customerId && !scopedCustomerIds.includes(customerId)) {
        throw new NotFoundError(`Customer with ID '${customerId}' not found`);
      }
    }

    const followUps = await followUpService.getFollowUps(
      filter,
      status,
      customerId,
      assignedTo,
      scopedCustomerIds,
      scopedPartner
    );
    sendSuccess(res, followUps, 'Follow-up tasks loaded');
  } catch (error) {
    next(error);
  }
};

export const createFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = { ...req.body };

    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        payload.customerId
      );

      if (req.user.role === Role.PARTNER) {
        const partnerScope = await customerAccessService.getPartnerCaregiverScope(req.user.userId);
        const targetUserId = payload.assignedToUserId;
        if (targetUserId && targetUserId !== req.user.userId) {
          throw new ForbiddenError('Đối tác không có quyền phân công lịch chăm sóc cho nhân viên khác');
        }
        if (payload.assignedTo) {
          const targetName = payload.assignedTo.trim().toLowerCase();
          const isMatched = partnerScope.aliases.some((a) => a.toLowerCase() === targetName);
          if (!isMatched) {
            throw new ForbiddenError('Đối tác không có quyền phân công lịch chăm sóc cho nhân viên khác');
          }
        }
        // Automatically bind Partner's own schedule to their account if not specified
        if (!payload.assignedToUserId && !payload.assignedTo) {
          payload.assignedToUserId = req.user.userId;
          payload.assignedTo = partnerScope.fullName || null;
        }
      }
    }

    const followUp = await followUpService.createFollowUp(payload);
    sendCreated(res, followUp, 'Follow-up task scheduled');
  } catch (error) {
    next(error);
  }
};

export const createBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = { ...req.body };

    if (req.user && req.user.role === Role.PARTNER) {
      const [assignedIds, partnerScope] = await Promise.all([
        customerAccessService.getAssignedCustomerIds(req.user.userId),
        customerAccessService.getPartnerCaregiverScope(req.user.userId),
      ]);
      const assignedSet = new Set(assignedIds);
      const customerIds: string[] = Array.isArray(payload.customerIds) ? payload.customerIds : [];
      const hasUnauthorized = customerIds.some((id) => !assignedSet.has(id));
      if (hasUnauthorized) {
        throw new ForbiddenError('Bạn không có quyền lên lịch chăm sóc cho khách hàng ngoài phạm vi phân công');
      }

      if (payload.assignedToUserId && payload.assignedToUserId !== req.user.userId) {
        throw new ForbiddenError('Đối tác không có quyền phân công lịch chăm sóc cho nhân viên khác');
      }
      if (payload.assignedTo) {
        const targetName = payload.assignedTo.trim().toLowerCase();
        const isMatched = partnerScope.aliases.some((a) => a.toLowerCase() === targetName);
        if (!isMatched) {
          throw new ForbiddenError('Đối tác không có quyền phân công lịch chăm sóc cho nhân viên khác');
        }
      }
      if (!payload.assignedToUserId && !payload.assignedTo) {
        payload.assignedToUserId = req.user.userId;
        payload.assignedTo = partnerScope.fullName || null;
      }
    }

    const result = await followUpService.createBulkFollowUps(payload);
    sendCreated(res, result, 'Bulk follow-up tasks scheduled');
  } catch (error) {
    next(error);
  }
};

export const completeBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let actorFullName: string | undefined;
    if (req.user) {
      const u = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { fullName: true },
      });
      actorFullName = u?.fullName;

      // For PARTNER, verify every requested schedule belongs to their authorized scope before executing
      if (req.user.role === Role.PARTNER) {
        const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];
        for (const id of ids) {
          await customerAccessService.assertFollowUpAccess(
            { id: req.user.userId, role: req.user.role },
            id
          );
        }
      }
    }

    const result = await followUpService.completeBulkFollowUps(req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
      role: req.user?.role,
      fullName: actorFullName,
    });
    sendSuccess(res, result, 'Lịch chăm sóc đã được cập nhật hoàn thành');
  } catch (error) {
    next(error);
  }
};

export const reopenBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user && req.user.role !== Role.ADMIN) {
      throw new ForbiddenError('Chỉ Quản trị viên (ADMIN) mới có quyền mở lại lịch chăm sóc');
    }
    const result = await followUpService.reopenBulkFollowUps(req.body);
    sendSuccess(res, result, 'Mở lại lịch chăm sóc hoàn tất');
  } catch (error) {
    next(error);
  }
};

export const reassignBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user && req.user.role !== Role.ADMIN) {
      throw new ForbiddenError('Chỉ Quản trị viên (ADMIN) mới có quyền đổi người chăm sóc');
    }
    const result = await followUpService.reassignBulkFollowUps({
      ...req.body,
      assignedById: req.user?.userId || null,
    });
    sendSuccess(res, result, 'Cập nhật người chăm sóc hàng loạt hoàn tất');
  } catch (error) {
    next(error);
  }
};

export const deleteBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user && req.user.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không có quyền xóa lịch chăm sóc hàng loạt');
    }
    const result = await followUpService.deleteBulkFollowUps(req.body);
    sendSuccess(res, result, 'Xóa lịch chăm sóc hàng loạt hoàn tất');
  } catch (error) {
    next(error);
  }
};

export const updateFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = { ...req.body };
    let actorFullName: string | undefined;

    if (req.user) {
      // 1. Verify customer & schedule-level ownership (throws 404/403 if unauthorized)
      await customerAccessService.assertFollowUpAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );

      const [current, actorUser] = await Promise.all([
        followUpService.getFollowUpById(req.params.id),
        prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { fullName: true },
        }),
      ]);
      actorFullName = actorUser?.fullName;

      if (req.user.role === Role.PARTNER) {
        // Partner cannot reassign caregiver to another person
        const isChangingUserId =
          payload.assignedToUserId !== undefined &&
          (payload.assignedToUserId || null) !== (current.assignedToUserId || null);
        const isChangingName =
          payload.assignedTo !== undefined &&
          (payload.assignedTo || null) !== (current.assignedTo || null);

        if (isChangingUserId || isChangingName) {
          throw new ForbiddenError('Đối tác không có quyền thay đổi người chăm sóc');
        }

        // Strip caregiver fields and client-sent completedAt from Partner payload
        delete payload.assignedTo;
        delete payload.assignedToUserId;
        delete payload.completedAt;
        delete payload.customerId;

        if (current.status === FollowUpStatus.CANCELLED) {
          throw new BadRequestError('Lịch chăm sóc đã bị hủy, không thể cập nhật tiến độ hoặc hoàn thành');
        }

        if (
          current.status === FollowUpStatus.COMPLETED &&
          payload.status &&
          payload.status !== FollowUpStatus.COMPLETED
        ) {
          throw new ForbiddenError(
            'Lịch chăm sóc đã hoàn thành. Chỉ Quản trị viên (ADMIN) mới có quyền mở lại lịch chăm sóc.'
          );
        }
      }
    }

    const updated = await followUpService.updateFollowUp(req.params.id, payload, {
      userId: req.user?.userId,
      email: req.user?.email,
      role: req.user?.role,
      fullName: actorFullName,
    });
    sendSuccess(res, updated, 'Follow-up task updated');
  } catch (error) {
    next(error);
  }
};

export const deleteFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      if (req.user.role === Role.PARTNER) {
        throw new ForbiddenError('Đối tác không có quyền xóa lịch chăm sóc');
      }

      await customerAccessService.assertFollowUpAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    await followUpService.deleteFollowUp(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Follow-up task removed');
  } catch (error) {
    next(error);
  }
};
