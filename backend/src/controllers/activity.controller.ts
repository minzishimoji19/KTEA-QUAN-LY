import { Request, Response, NextFunction } from 'express';
import { activityService } from '../services/activity.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getActivitiesByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activities = await activityService.getActivitiesByCustomerId(req.params.id);
    sendSuccess(res, activities, 'Customer activity feed loaded');
  } catch (error) {
    next(error);
  }
};

export const createActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activity = await activityService.createActivity(req.params.id, req.body);
    sendCreated(res, activity, 'Activity interaction logged');
  } catch (error) {
    next(error);
  }
};
