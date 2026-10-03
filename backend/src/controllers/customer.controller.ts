import { Request, Response, NextFunction } from 'express';
import { customerService } from '../services/customer.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';

import { CustomerQueryFilters } from '../repositories/customer.repository.js';

export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await customerService.getCustomers(req.query as unknown as CustomerQueryFilters);
    sendPaginated(res, result.items, result.pagination, 'Customers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await customerService.getCustomerDetail(req.params.id);
    sendSuccess(res, customer, 'Customer detail loaded');
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const customer = await customerService.createCustomer(req.body);
    sendCreated(res, customer, 'Customer created successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await customerService.updateCustomer(req.params.id, req.body);
    sendSuccess(res, updated, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await customerService.deleteCustomer(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Customer deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const addCustomerTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await customerService.addTag(req.params.id, req.params.tagId);
    sendCreated(res, result, 'Tag attached to customer');
  } catch (error) {
    next(error);
  }
};

export const removeCustomerTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await customerService.removeTag(req.params.id, req.params.tagId);
    sendSuccess(res, result, 'Tag removed from customer');
  } catch (error) {
    next(error);
  }
};
