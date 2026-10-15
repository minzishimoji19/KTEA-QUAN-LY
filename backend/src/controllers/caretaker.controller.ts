import { Request, Response, NextFunction } from 'express';
import { caretakerService } from '../services/caretaker.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getCaretakers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const caretakers = await caretakerService.getAllCaretakers(activeOnly);
    sendSuccess(res, caretakers, 'Danh sách người chăm sóc');
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
