import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service.js';
import { sendSuccess } from '../utils/response.js';

export const getDashboardData = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await dashboardService.getDashboard();
    sendSuccess(res, data, 'Operational workspace dashboard data loaded');
  } catch (error) {
    next(error);
  }
};
