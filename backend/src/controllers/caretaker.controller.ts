import { Request, Response, NextFunction } from 'express';
import { caretakerService } from '../services/caretaker.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getCaretakers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const forScheduling = req.query.forScheduling === 'true';
    const caretakers = await caretakerService.getAllCaretakers({ activeOnly, forScheduling });
    sendSuccess(res, caretakers, 'Danh sách người chăm sóc');
  } catch (error) {
    next(error);
  }
};

export const getAvailablePartners = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const partners = await caretakerService.getAvailablePartners();
    sendSuccess(res, partners, 'Danh sách tài khoản đối tác khả dụng để liên kết');
  } catch (error) {
    next(error);
  }
};

export const linkCaretaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await caretakerService.linkCaretakerToUser(
      { id: req.user!.userId, email: req.user!.email },
      req.params.id,
      req.body.userId
    );
    sendSuccess(res, updated, 'Liên kết người chăm sóc với tài khoản đối tác thành công');
  } catch (error) {
    next(error);
  }
};

export const unlinkCaretaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await caretakerService.unlinkCaretakerFromUser(
      { id: req.user!.userId, email: req.user!.email },
      req.params.id
    );
    sendSuccess(res, updated, 'Đã gỡ liên kết tài khoản khỏi người chăm sóc');
  } catch (error) {
    next(error);
  }
};

export const getBackfillPreview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const preview = await caretakerService.getBackfillPreview();
    sendSuccess(res, preview, 'Báo cáo xem trước đồng bộ dữ liệu phân công lịch sử');
  } catch (error) {
    next(error);
  }
};

export const backfillCaretaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await caretakerService.backfillCaregiverAssignments(
      { id: req.user!.userId, email: req.user!.email },
      req.params.id
    );
    sendSuccess(res, result, 'Đồng bộ khách hàng lịch sử cho người chăm sóc thành công');
  } catch (error) {
    next(error);
  }
};

export const backfillAllCaretakers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await caretakerService.backfillAllCaregivers(
      { id: req.user!.userId, email: req.user!.email }
    );
    sendSuccess(res, result, 'Đồng bộ toàn bộ người chăm sóc đã liên kết thành công');
  } catch (error) {
    next(error);
  }
};

export const getCaretakerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const caretaker = await caretakerService.getCaretakerById(req.params.id);
    sendSuccess(res, caretaker, 'Chi tiết người chăm sóc');
  } catch (error) {
    next(error);
  }
};

export const createCaretaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const created = await caretakerService.createCaretaker(req.body);
    sendCreated(res, created, 'Tạo người chăm sóc thành công');
  } catch (error) {
    next(error);
  }
};

export const updateCaretaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await caretakerService.updateCaretaker(req.params.id, req.body);
    sendSuccess(res, updated, 'Cập nhật người chăm sóc thành công');
  } catch (error) {
    next(error);
  }
};

export const deleteCaretaker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await caretakerService.deleteCaretaker(req.params.id);
    sendSuccess(res, { id: req.params.id }, 'Xóa người chăm sóc thành công');
  } catch (error) {
    next(error);
  }
};

