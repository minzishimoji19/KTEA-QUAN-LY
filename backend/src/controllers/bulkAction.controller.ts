import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { bulkActionService } from '../services/bulkAction.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { sendSuccess } from '../utils/response.js';
import { ForbiddenError } from '../utils/errors.js';

export const executeBulkAction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role === Role.PARTNER) {
      throw new ForbiddenError('Chỉ Quản trị viên (Admin) mới có quyền thực hiện thao tác hàng loạt');
    }

    const result = await bulkActionService.execute(req.body);

    if (req.user) {
      await auditLogService.log({
        actorId: req.user.userId,
        actorEmail: req.user.email,
        action: `BULK_ACTION_${result.action}`,
        entityType: 'Customer',
        details: { affected: result.affected, action: result.action },
      });
    }

    sendSuccess(res, result, `Bulk action "${result.action}" completed: ${result.affected} customers updated`);
  } catch (error) {
    next(error);
  }
};

