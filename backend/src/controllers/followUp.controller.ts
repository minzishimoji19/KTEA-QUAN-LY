import { Request, Response, NextFunction } from 'express';
import { followUpService } from '../services/followUp.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

import { FollowUpStatus } from '@prisma/client';

export const getFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter = req.query.filter as 'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | undefined;
    const status = req.query.status as FollowUpStatus | undefined;
    const customerId = req.query.customerId as string | undefined;
    const assignedTo = req.query.assignedTo as string | undefined;
    const followUps = await followUpService.getFollowUps(filter, status, customerId, assignedTo);
    sendSuccess(res, followUps, 'Follow-up tasks loaded');
  } catch (error) {
    next(error);
  }
};

export const createFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const followUp = await followUpService.createFollowUp(req.body);
    sendCreated(res, followUp, 'Follow-up task scheduled');
  } catch (error) {
    next(error);
  }
};

export const createBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await followUpService.createBulkFollowUps(req.body);
    sendCreated(res, result, 'Bulk follow-up tasks scheduled');
  } catch (error) {
    next(error);
  }
};

export const completeBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await followUpService.completeBulkFollowUps(req.body);
    sendSuccess(res, result, 'Lịch chăm sóc đã được cập nhật hoàn thành');
  } catch (error) {
    next(error);
  }
};

export const deleteBulkFollowUps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await followUpService.deleteBulkFollowUps(req.body);
    sendSuccess(res, result, 'Xóa lịch chăm sóc hàng loạt hoàn tất');
  } catch (error) {
    next(error);
  }
};

export const updateFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await followUpService.updateFollowUp(req.params.id, req.body);
    sendSuccess(res, updated, 'Follow-up task updated');
  } catch (error) {
    next(error);
  }
};

export const deleteFollowUp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await followUpService.deleteFollowUp(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Follow-up task removed');
  } catch (error) {
    next(error);
  }
};
