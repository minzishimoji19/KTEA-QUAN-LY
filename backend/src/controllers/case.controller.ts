import { Request, Response, NextFunction } from 'express';
import { caseService } from '../services/case.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getCasesByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cases = await caseService.getCasesByCustomerId(req.params.id);
    sendSuccess(res, cases, 'Customer cases retrieved');
  } catch (error) {
    next(error);
  }
};

export const createCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const created = await caseService.createCase(req.params.id, req.body);
    sendCreated(res, created, 'Application case logged successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await caseService.updateCase(req.params.id, req.body);
    sendSuccess(res, updated, 'Case updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await caseService.deleteCase(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Case deleted successfully');
  } catch (error) {
    next(error);
  }
};
