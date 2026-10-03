import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service.js';
import { sendSuccess } from '../utils/response.js';

export const getOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await analyticsService.getOverview(startDate, endDate);
    sendSuccess(res, data, 'Analytics overview retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getCustomerAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await analyticsService.getCustomers(startDate, endDate);
    sendSuccess(res, data, 'Customer analytics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getCaseAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await analyticsService.getCases(startDate, endDate);
    sendSuccess(res, data, 'Case analytics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getNeedAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await analyticsService.getNeeds(startDate, endDate);
    sendSuccess(res, data, 'Need analytics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getPushAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const data = await analyticsService.getPush(startDate, endDate);
    sendSuccess(res, data, 'Push analytics retrieved successfully');
  } catch (error) {
    next(error);
  }
};
