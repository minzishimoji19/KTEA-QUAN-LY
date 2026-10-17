import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/response.js';
import { Role } from '@prisma/client';
import { customerAccessService } from '../services/customerAccess.service.js';

export const getDashboardData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let scopedCustomerIds: string[] | undefined;
    if (req.user && req.user.role === Role.PARTNER) {
      scopedCustomerIds = await customerAccessService.getAssignedCustomerIds(req.user.userId);
    }
    const data = await dashboardService.getDashboard(scopedCustomerIds);
    sendSuccess(res, data, 'Operational workspace dashboard data loaded');
  } catch (error) {
    next(error);
  }
};
