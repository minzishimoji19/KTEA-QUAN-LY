import { Request, Response, NextFunction } from 'express';
import { pushRecordService } from '../services/pushRecord.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

import { PushStatus } from '@prisma/client';

export const getAllPushRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status as PushStatus | undefined;
    const pushes = await pushRecordService.getAllPushRecords(status);
    sendSuccess(res, pushes, 'Push records retrieved');
  } catch (error) {
    next(error);
  }
};

export const getPushRecordsByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const pushes = await pushRecordService.getPushRecordsByCustomerId(req.params.id);
    sendSuccess(res, pushes, 'Customer push records loaded');
  } catch (error) {
    next(error);
  }
};

export const createPushRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const push = await pushRecordService.createPushRecord(req.params.id, req.body);
    sendCreated(res, push, 'Customer push record initiated');
  } catch (error) {
    next(error);
  }
};

export const updatePushRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await pushRecordService.updatePushRecord(req.params.id, req.body);
    sendSuccess(res, updated, 'Push record updated');
  } catch (error) {
    next(error);
  }
};
