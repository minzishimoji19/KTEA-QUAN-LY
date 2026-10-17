import { Request, Response, NextFunction } from 'express';
import { needService } from '../services/need.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { customerAccessService } from '../services/customerAccess.service.js';

export const getNeedsByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const needs = await needService.getNeedsByCustomerId(req.params.id);
    sendSuccess(res, needs, 'Customer needs loaded');
  } catch (error) {
    next(error);
  }
};

export const createNeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const need = await needService.createNeed(req.params.id, req.body);
    sendCreated(res, need, 'Customer need logged');
  } catch (error) {
    next(error);
  }
};

export const updateNeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertNeedAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const updated = await needService.updateNeed(req.params.id, req.body);
    sendSuccess(res, updated, 'Customer need updated');
  } catch (error) {
    next(error);
  }
};

export const deleteNeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertNeedAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    await needService.deleteNeed(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Customer need removed');
  } catch (error) {
    next(error);
  }
};
