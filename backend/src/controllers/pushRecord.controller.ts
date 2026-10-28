import { Request, Response, NextFunction } from 'express';
import { pushRecordService } from '../services/pushRecord.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { PushStatus, Role } from '@prisma/client';
import { customerAccessService } from '../services/customerAccess.service.js';

export const getAllPushRecords = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status as PushStatus | undefined;
    let scopedCustomerIds: string[] | undefined;
    if (req.user && req.user.role === Role.PARTNER) {
      const partnerScope = await customerAccessService.getPartnerCustomerScope(req.user.userId);
      scopedCustomerIds = partnerScope.allIds;
    }
    const pushes = await pushRecordService.getAllPushRecords(status, scopedCustomerIds);
    sendSuccess(res, pushes, 'Push records retrieved');
  } catch (error) {
    next(error);
  }
};

export const getPushRecordsByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const pushes = await pushRecordService.getPushRecordsByCustomerId(req.params.id);
    sendSuccess(res, pushes, 'Customer push records loaded');
  } catch (error) {
    next(error);
  }
};

export const createPushRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerWriteAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const push = await pushRecordService.createPushRecord(req.params.id, req.body);
    sendCreated(res, push, 'Customer push record initiated');
  } catch (error) {
    next(error);
  }
};

export const updatePushRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertPushRecordAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const updated = await pushRecordService.updatePushRecord(req.params.id, req.body);
    sendSuccess(res, updated, 'Push record updated');
  } catch (error) {
    next(error);
  }
};
