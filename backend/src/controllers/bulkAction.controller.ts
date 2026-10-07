import { Request, Response, NextFunction } from 'express';
import { bulkActionService } from '../services/bulkAction.service.js';
import { sendSuccess } from '../utils/response.js';

export const executeBulkAction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await bulkActionService.execute(req.body);
    sendSuccess(res, result, `Bulk action "${result.action}" completed: ${result.affected} customers updated`);
  } catch (error) {
    next(error);
  }
};
