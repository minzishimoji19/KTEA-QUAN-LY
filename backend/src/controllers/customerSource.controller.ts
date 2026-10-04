import { Request, Response, NextFunction } from 'express';
import { customerSourceService } from '../services/customerSource.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getCustomerSources = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const sources = await customerSourceService.getAllSources(activeOnly);
    sendSuccess(res, sources, 'Customer sources retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getCustomerSourceById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = await customerSourceService.getSourceById(req.params.id);
    sendSuccess(res, source, 'Customer source retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createCustomerSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = await customerSourceService.createSource(req.body);
    sendCreated(res, source, 'Customer source created successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCustomerSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const source = await customerSourceService.updateSource(req.params.id, req.body);
    sendSuccess(res, source, 'Customer source updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCustomerSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await customerSourceService.deleteSource(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Customer source deleted successfully');
  } catch (error) {
    next(error);
  }
};
