import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { customerService } from '../services/customer.service.js';
import { customerAccessService } from '../services/customerAccess.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { ForbiddenError } from '../utils/errors.js';
import { CustomerQueryFilters } from '../repositories/customer.repository.js';

export const getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filters: CustomerQueryFilters = { ...(req.query as unknown as CustomerQueryFilters) };
    if (req.user && req.user.role === Role.PARTNER) {
      filters.scopedCustomerIds = await customerAccessService.getAssignedCustomerIds(req.user.userId);
    }
    const result = await customerService.getCustomers(filters);
    sendPaginated(res, result.items, result.pagination, 'Customers retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const customer = await customerService.getCustomerDetail(req.params.id);
    sendSuccess(res, customer, 'Customer detail loaded');
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không được phép tạo khách hàng mới');
    }
    const customer = await customerService.createCustomer(req.body);
    sendCreated(res, customer, 'Customer created successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không được phép chỉnh sửa thông tin cá nhân của khách hàng');
    }
    const updated = await customerService.updateCustomer(req.params.id, req.body);
    sendSuccess(res, updated, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không được phép xóa khách hàng');
    }
    await customerService.deleteCustomer(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Customer deleted successfully');
  } catch (error) {
    next(error);
  }
};

export const addCustomerTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const result = await customerService.addTag(req.params.id, req.params.tagId);
    sendCreated(res, result, 'Tag attached to customer');
  } catch (error) {
    next(error);
  }
};

export const removeCustomerTag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const result = await customerService.removeTag(req.params.id, req.params.tagId);
    sendSuccess(res, result, 'Tag removed from customer');
  } catch (error) {
    next(error);
  }
};
