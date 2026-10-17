import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { auditLogService } from '../services/auditLog.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await userService.listUsers();
    sendSuccess(res, users, 'Danh sách tài khoản nhân viên');
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, fullName, role, phone } = req.body;

    if (!email || !password || !fullName || !role) {
      throw new BadRequestError('Vui lòng điền đầy đủ email, mật khẩu, họ tên và vai trò');
    }

    if (password.length < 8) {
      throw new BadRequestError('Mật khẩu phải có tối thiểu 8 ký tự');
    }

    const newUser = await userService.createUser(
      { id: req.user!.userId, email: req.user!.email },
      { email, password, fullName, role, phone }
    );

    sendCreated(res, newUser, 'Tạo tài khoản thành công');
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, role, status, phone, password } = req.body;

    const updated = await userService.updateUser(
      { id: req.user!.userId, email: req.user!.email },
      id,
      { fullName, role, status, phone, password }
    );

    sendSuccess(res, updated, 'Cập nhật tài khoản thành công');
  } catch (error) {
    next(error);
  }
};

export const assignCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partnerUserId = req.body.partnerUserId || req.body.userId;
    const { customerIds, notes } = req.body;

    if (!partnerUserId || !customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      throw new BadRequestError('Vui lòng cung cấp partnerUserId và danh sách customerIds');
    }

    const result = await userService.assignCustomers(
      { id: req.user!.userId, email: req.user!.email },
      partnerUserId,
      customerIds,
      notes
    );

    sendSuccess(res, result, `Phân công thành công ${result.affected} khách hàng`);
  } catch (error) {
    next(error);
  }
};

export const unassignCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { partnerUserId, customerId } = req.body;

    if (!partnerUserId || !customerId) {
      throw new BadRequestError('Vui lòng cung cấp partnerUserId và customerId');
    }

    const result = await userService.unassignCustomer(
      { id: req.user!.userId, email: req.user!.email },
      partnerUserId,
      customerId
    );

    sendSuccess(res, result, 'Đã thu hồi quyền phụ trách khách hàng');
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const action = req.query.action as string | undefined;
    const entityType = req.query.entityType as string | undefined;

    const logs = await auditLogService.getLogs({ limit, action, entityType });
    sendSuccess(res, logs, 'Nhật ký kiểm toán hệ thống');
  } catch (error) {
    next(error);
  }
};

export const getUserAssignments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = req.params.id;
    if (!targetUserId) {
      throw new BadRequestError('Vui lòng cung cấp ID người dùng');
    }

    const assignments = await userService.getUserAssignments(
      { id: req.user!.userId, role: req.user!.role },
      targetUserId
    );

    sendSuccess(res, assignments, 'Danh sách khách hàng được phân công');
  } catch (error) {
    next(error);
  }
};
