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
    let scopedPartner: { userId: string; aliases: string[] } | undefined;
    if (req.user && req.user.role === Role.PARTNER) {
      [scopedCustomerIds, scopedPartner] = await Promise.all([
        customerAccessService.getAssignedCustomerIds(req.user.userId),
        customerAccessService.getPartnerCaregiverScope(req.user.userId),
      ]);
    }
    const data = await dashboardService.getDashboard(scopedCustomerIds, scopedPartner);
    sendSuccess(res, data, 'Operational workspace dashboard data loaded');
  } catch (error) {
    next(error);
  }
};
