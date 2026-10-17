import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { caseService } from '../services/case.service.js';
import { customerAccessService } from '../services/customerAccess.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { ForbiddenError, BadRequestError } from '../utils/errors.js';

const PARTNER_ALLOWED_CASE_UPDATE_FIELDS = [
  'progress',
  'caseStatus',
  'resultDate',
  'rejectedAt',
  'rejectionReason',
  'rejectionNote',
  'failureReason',
  'notes',
] as const;

export const getCasesByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const cases = await caseService.getCasesByCustomerId(req.params.id);
    sendSuccess(res, cases, 'Customer cases retrieved');
  } catch (error) {
    next(error);
  }
};

export const getCaseById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCaseAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const customerCase = await caseService.getCaseById(req.params.id);
    sendSuccess(res, customerCase, 'Case retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không được phép tạo mới hồ sơ vay');
    }
    if (req.user) {
      await customerAccessService.assertCustomerAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const created = await caseService.createCase(req.params.id, req.body);

    if (req.user) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: 'CREATE_CASE',
        entityType: 'CustomerCase',
        entityId: created.id,
        details: { customerId: req.params.id, caseId: created.id },
      });
    }

    sendCreated(res, created, 'Application case created successfully');
  } catch (error) {
    next(error);
  }
};

export const selectProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không được phép thay đổi gói sản phẩm của hồ sơ');
    }
    if (req.user) {
      await customerAccessService.assertCaseAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const updated = await caseService.selectProduct(req.params.id, req.body);
    sendSuccess(res, updated, 'Product assigned to case successfully');
  } catch (error) {
    next(error);
  }
};

export const updateProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCaseAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const updated = await caseService.updateProgress(req.params.id, req.body);

    if (req.user) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: 'UPDATE_CASE_PROGRESS',
        entityType: 'CustomerCase',
        entityId: req.params.id,
        details: { toProgress: req.body.toProgress, note: req.body.note },
      });
    }

    sendSuccess(res, updated, 'Case progress updated successfully');
  } catch (error) {
    next(error);
  }
};

export const rejectCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCaseAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    const updated = await caseService.rejectCase(req.params.id, req.body);

    if (req.user) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: 'REJECT_CASE',
        entityType: 'CustomerCase',
        entityId: req.params.id,
        details: { reason: req.body.reason, note: req.body.note },
      });
    }

    sendSuccess(res, updated, 'Case rejected successfully');
  } catch (error) {
    next(error);
  }
};

export const updateCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      await customerAccessService.assertCaseAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }

    let updateData = req.body;

    // Enforce strict field allowlist for PARTNER
    if (req.user?.role === Role.PARTNER) {
      const submittedKeys = Object.keys(req.body);
      const unauthorizedKeys = submittedKeys.filter(
        (key) => !PARTNER_ALLOWED_CASE_UPDATE_FIELDS.includes(key as any)
      );

      if (unauthorizedKeys.length > 0) {
        throw new ForbiddenError(
          `Đối tác không được phép cập nhật các trường: ${unauthorizedKeys.join(', ')}`
        );
      }

      updateData = {};
      for (const field of PARTNER_ALLOWED_CASE_UPDATE_FIELDS) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }
    }

    const updated = await caseService.updateCase(req.params.id, updateData);

    if (req.user) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: 'UPDATE_CASE',
        entityType: 'CustomerCase',
        entityId: req.params.id,
        details: { updatedFields: Object.keys(updateData) },
      });
    }

    sendSuccess(res, updated, 'Case updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Đối tác không được phép xóa hồ sơ vay');
    }
    if (req.user) {
      await customerAccessService.assertCaseAccess(
        { id: req.user.userId, role: req.user.role },
        req.params.id
      );
    }
    await caseService.deleteCase(req.params.id);

    if (req.user) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: 'DELETE_CASE',
        entityType: 'CustomerCase',
        entityId: req.params.id,
      });
    }

    sendSuccess(res, { id: req.params.id }, 'Case deleted successfully');
  } catch (error) {
    next(error);
  }
};


