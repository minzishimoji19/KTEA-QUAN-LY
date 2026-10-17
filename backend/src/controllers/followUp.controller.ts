import { Request, Response, NextFunction } from 'express';
import { followUpService } from '../services/followUp.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { FollowUpStatus, Role } from '@prisma/client';
import { customerAccessService } from '../services/customerAccess.service.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import prisma from '../config/database.js';

export const getFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter = req.query.filter as 'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | undefined;
    const status = req.query.status as FollowUpStatus | undefined;
    const customerId = req.query.customerId as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;

    let scopedCustomerIds: string[] | undefined;
    if (req.user && req.user.role === Role.PARTNER) {
      scopedCustomerIds = await customerAccessService.getAssignedCustomerIds(req.user.userId);
      if (customerId && !scopedCustomerIds.includes(customerId)) {
        throw new NotFoundError(`Customer with ID '${customerId}' not found`);
      }
    }

    const followUps = await followUpService.getFollowUps(filter, status, customerId, assignedTo, scopedCustomerIds);
    sendSuccess(res, followUps, 'Follow-up tasks loaded');
  } catch (error) {
    next(error);
  }
};

export const createFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.body.customerId
      );

      if (req.user.role === Role.PARTNER && req.body.assignedTo) {
        const partnerCaretaker = await prisma.caretaker.findFirst({
          where: { userId: req.user.userId },
        });
        if (
          !partnerCaretaker ||
          partnerCaretaker.name.trim().toLowerCase() !== req.body.assignedTo.trim().toLowerCase()
        ) {
          throw new ForbiddenError('Đối tác không có quyền phân công lịch chăm sóc cho nhân viên khác');
        }
      }
    }
    const followUp = await followUpService.createFollowUp(req.body);
    sendCreated(res, followUp, 'Follow-up task scheduled');
  } catch (error) {
    next(error);
  }
};

export const createBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user && req.user.role === Role.PARTNER) {
      const assignedIds = await customerAccessService.getAssignedCustomerIds(req.user.userId);
      const assignedSet = new Set(assignedIds);
      const customerIds: string[] = Array.isArray(req.body.customerIds) ? req.body.customerIds : [];
      const hasUnauthorized = customerIds.some((id) => !assignedSet.has(id));
      if (hasUnauthorized) {
        throw new ForbiddenError('Bạn không có quyền lên lịch chăm sóc cho khách hàng ngoài phạm vi phân công');
      }
    }
    const result = await followUpService.createBulkFollowUps(req.body);
    sendCreated(res, result, 'Bulk follow-up tasks scheduled');
  } catch (error) {
    next(error);
  }
};

export const completeBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user && req.user.role === Role.PARTNER) {
      const assignedIds = await customerAccessService.getAssignedCustomerIds(req.user.userId);
      const assignedSet = new Set(assignedIds);
      const ids: string[] = Array.isArray(req.body.ids) ? req.body.ids : [];
      
      const followUps = await prisma.followUp.findMany({
        where: { id: { in: ids } },
        select: { id: true, customerId: true },
      });

      const unauthorized = followUps.some((f) => !assignedSet.has(f.customerId));
      if (unauthorized) {
        throw new ForbiddenError('Bạn không có quyền hoàn thành lịch chăm sóc ngoài phạm vi phân công');
      }
    }
    const result = await followUpService.completeBulkFollowUps(req.body);
    sendSuccess(res, result, 'Lịch chăm sóc đã được cập nhật hoàn thành');
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
    if (req.user) {
      if (req.user.role === Role.PARTNER && req.body.assignedTo !== undefined) {
        throw new ForbiddenError('Đối tác không có quyền thay đổi người chăm sóc');
      }

      await customerAccessService.assertFollowUpAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const updated = await followUpService.updateFollowUp(req.params.id, req.body);
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
