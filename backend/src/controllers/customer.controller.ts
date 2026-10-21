import { Request, Response, NextFunction } from 'express';
import { Role, CustomerStatus } from '@prisma/client';
import { customerService } from '../services/customer.service.js';
import { customerAccessService } from '../services/customerAccess.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { sendSuccess, sendCreated, sendPaginated } from '../utils/response.js';
import { ForbiddenError, BadRequestError } from '../utils/errors.js';
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
    // 1. Enforce Customer Access Scope (Partners only access assigned customers; Admins have universal access)
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }

    // 2. Fetch current customer to get baseline status for audit logging
    const currentCustomer = await customerService.getCustomerById(req.params.id);

    // 3. Role-Based Field Allowlist & Restriction Enforcement
    if (req.user?.role === Role.PARTNER) {
      // Forbidden fields that PARTNER cannot update on Customer master record
      const forbiddenFields = [
        'fullName',
        'phone',
        'email',
        'gender',
        'dateOfBirth',
        'address',
        'note',
        'source',
        'sourceId',
        'priority',
      ];

      const attemptedForbidden = forbiddenFields.filter(
        (field) => (req.body as Record<string, unknown>)[field] !== undefined
      );

      if (attemptedForbidden.length > 0) {
        throw new ForbiddenError('Đối tác không được phép chỉnh sửa thông tin cá nhân của khách hàng');
      }

      // Check if overallStatus is provided and valid
      const targetStatus = req.body.overallStatus;
      if (!targetStatus || !Object.values(CustomerStatus).includes(targetStatus)) {
        throw new BadRequestError('Vui lòng cung cấp trạng thái chăm sóc hợp lệ để cập nhật');
      }

      // Execute update with strictly isolated overallStatus payload
      const updated = await customerService.updateCustomer(
        req.params.id,
        { overallStatus: targetStatus },
        req.user
      );

      // Audit log important status update
      if (req.user) {
        await auditLogService.log({
          actorId: req.user.userId,
          actorEmail: req.user.email,
          action: 'UPDATE_CUSTOMER_STATUS',
          entityType: 'Customer',
          entityId: req.params.id,
          details: {
            customerId: req.params.id,
            previousStatus: currentCustomer.rawOverallStatus || currentCustomer.overallStatus,
            newStatus: targetStatus,
          },
        });
      }

      sendSuccess(res, updated, 'Trạng thái chăm sóc đã được cập nhật thành công');
      return;
    }

    // ADMIN: updates allowed fields from request body
    const updated = await customerService.updateCustomer(req.params.id, req.body, req.user);

    if (req.user && req.body.overallStatus) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: 'UPDATE_CUSTOMER_STATUS',
        entityType: 'Customer',
        entityId: req.params.id,
        details: {
          customerId: req.params.id,
          previousStatus: currentCustomer.rawOverallStatus || currentCustomer.overallStatus,
          newStatus: req.body.overallStatus,
        },
      });
    }

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
