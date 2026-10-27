import { Request, Response, NextFunction } from 'express';
import { assessmentService } from '../services/assessment.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getAssessmentsByCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = {
      id: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
    const assessments = await assessmentService.getAssessmentsByCustomerId(req.params.id, user);
    sendSuccess(res, assessments, 'Danh sách khảo sát nhu cầu của khách hàng');
  } catch (error) {
    next(error);
  }
};

export const startAssessment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = {
      id: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
    const assessment = await assessmentService.startAssessment(req.params.id, user, req.body);
    sendCreated(res, assessment, 'Khởi tạo lượt đánh giá nhu cầu thành công');
  } catch (error) {
    next(error);
  }
};

export const getAssessmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = {
      id: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
    const assessment = await assessmentService.getAssessmentById(req.params.assessmentId, user);
    sendSuccess(res, assessment, 'Chi tiết bài đánh giá nhu cầu');
  } catch (error) {
    next(error);
  }
};

export const saveAssessmentAnswers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = {
      id: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
    const updated = await assessmentService.saveAnswers(
      req.params.assessmentId,
      user,
      req.body.answers,
      req.body.notes
    );
    sendSuccess(res, updated, 'Lưu câu trả lời thành công');
  } catch (error) {
    next(error);
  }
};

export const completeAssessment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = {
      id: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
    const completed = await assessmentService.completeAssessment(
      req.params.assessmentId,
      user,
      req.body.answers,
      req.body.notes
    );
    sendSuccess(res, completed, 'Hoàn thành khảo sát nhu cầu thành công');
  } catch (error) {
    next(error);
  }
};

export const cancelAssessment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = {
      id: req.user!.userId,
      role: req.user!.role,
      email: req.user!.email,
    };
    await assessmentService.cancelAssessment(req.params.assessmentId, user);
    sendSuccess(res, { assessmentId: req.params.assessmentId }, 'Đã hủy bài khảo sát nhu cầu');
  } catch (error) {
    next(error);
  }
};
