import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { activityService } from '../services/activity.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { customerAccessService } from '../services/customerAccess.service.js';
import { customerService } from '../services/customer.service.js';

export const getActivitiesByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }

    if (req.user?.role === Role.PARTNER) {
      const partnerScope = await customerAccessService.getPartnerCustomerScope(req.user.userId);
      const detail = await customerService.getCustomerDetail(
        req.params.id,
        req.user.userId,
        partnerScope
      );
      sendSuccess(res, detail.activities || [], 'Customer activity feed loaded');
      return;
    }

    const activities = await activityService.getActivitiesByCustomerId(req.params.id);
    sendSuccess(res, activities, 'Customer activity feed loaded');
  } catch (error) {
    next(error);
  }
};

export const createActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerWriteAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const activity = await activityService.createActivity(req.params.id, req.body);
    sendCreated(res, activity, 'Activity interaction logged');
  } catch (error) {
    next(error);
  }
};
