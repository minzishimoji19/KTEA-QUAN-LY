import { Request, Response, NextFunction } from 'express';
import { akinatorService } from '../services/akinator.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import {
  AkinatorConfigStatus,
  AkinatorQuizStatus,
  AkinatorWorkflowStatus,
  AkinatorEvaluationStatus,
} from '@prisma/client';

// =========================================================================
// A. AKINATOR CONFIGURATION MANAGEMENT CONTROLLERS (ADMIN ONLY)
// =========================================================================

export const listAkinatorConfigs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = req.query.status as AkinatorConfigStatus | undefined;
    const configs = await akinatorService.listConfigs(status);
    sendSuccess(res, configs, 'Danh sách phiên bản cấu hình Akinator');
  } catch (error) {
    next(error);
  }
};

export const getCurrentPublishedAkinatorConfig = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await akinatorService.getCurrentPublishedConfig();
    sendSuccess(res, config, 'Phiên bản cấu hình Akinator đang xuất bản');
  } catch (error) {
    next(error);
  }
};

export const getAkinatorConfigById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await akinatorService.getConfigById(req.params.versionId);
    sendSuccess(res, config, 'Chi tiết phiên bản cấu hình Akinator');
  } catch (error) {
    next(error);
  }
};

export const createAkinatorDraftConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const created = await akinatorService.createDraftConfig(req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendCreated(res, created, 'Tạo bản nháp cấu hình Akinator thành công');
  } catch (error) {
    next(error);
  }
};

export const updateAkinatorDraftMetadata = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await akinatorService.updateDraftMetadata(req.params.versionId, req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, updated, 'Cập nhật thông tin cấu hình Akinator bản nháp thành công');
  } catch (error) {
    next(error);
  }
};

export const saveAkinatorDraftQuestions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await akinatorService.saveDraftQuestions(
      req.params.versionId,
      req.body.questions,
      {
        userId: req.user?.userId,
        email: req.user?.email,
      }
    );
    sendSuccess(res, updated, 'Lưu danh sách câu hỏi Akinator bản nháp thành công');
  } catch (error) {
    next(error);
  }
};

export const saveAkinatorDraftRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await akinatorService.saveDraftRules(
      req.params.versionId,
      req.body.rules,
      {
        userId: req.user?.userId,
        email: req.user?.email,
      }
    );
    sendSuccess(res, updated, 'Lưu danh sách quy tắc đánh giá Akinator bản nháp thành công');
  } catch (error) {
    next(error);
  }
};

export const validateAkinatorConfigVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await akinatorService.validateConfigVersion(req.params.versionId);
    sendSuccess(res, result, 'Kết quả kiểm tra tính toàn vẹn cấu hình Akinator');
  } catch (error) {
    next(error);
  }
};

export const publishAkinatorConfigVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const published = await akinatorService.publishConfigVersion(
      req.params.versionId,
      req.body?.changeLog,
      {
        userId: req.user?.userId,
        email: req.user?.email,
      }
    );
    sendSuccess(res, published, 'Xuất bản phiên bản cấu hình Akinator thành công');
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// B. PUBLIC QUIZ SESSION CONTROLLERS (TOKEN-SCOPED, NO AUTH)
// =========================================================================

export const startPublicAkinatorSession = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionData = await akinatorService.startQuizSession();
    sendCreated(res, sessionData, 'Khởi tạo phiên làm quiz Akinator thành công');
  } catch (error) {
    next(error);
  }
};

export const getPublicAkinatorSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionData = await akinatorService.getQuizSessionByToken(req.params.token);
    sendSuccess(res, sessionData, 'Thông tin phiên làm quiz Akinator');
  } catch (error) {
    next(error);
  }
};

export const submitPublicAkinatorAnswer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stepResult = await akinatorService.submitQuizAnswer(req.params.token, req.body);
    sendSuccess(res, stepResult, 'Ghi nhận câu trả lời thành công');
  } catch (error) {
    next(error);
  }
};

export const completePublicAkinatorSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const completion = await akinatorService.completeQuizSession(req.params.token);
    sendSuccess(res, completion, 'Hoàn tất phiên làm quiz Akinator');
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// C. ADMIN REVIEW & WORKFLOW CONTROLLERS (ADMIN ONLY)
// =========================================================================

export const listAdminAkinatorSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await akinatorService.listSessionsForAdmin({
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      quizStatus: req.query.quizStatus as AkinatorQuizStatus | undefined,
      workflowStatus: req.query.workflowStatus as AkinatorWorkflowStatus | undefined,
      evaluationStatus: req.query.evaluationStatus as AkinatorEvaluationStatus | undefined,
      search: req.query.search as string | undefined,
      fromDate: req.query.fromDate as string | undefined,
      toDate: req.query.toDate as string | undefined,
    });
    sendSuccess(res, result, 'Danh sách hồ sơ Akinator');
  } catch (error) {
    next(error);
  }
};

export const getAdminAkinatorSessionDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const detail = await akinatorService.getSessionDetailForAdmin(req.params.id);
    sendSuccess(res, detail, 'Chi tiết hồ sơ Akinator');
  } catch (error) {
    next(error);
  }
};

export const updateAdminAkinatorReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await akinatorService.updateAdminReview(req.params.id, req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, updated, 'Cập nhật dữ liệu xử lý hồ sơ Akinator thành công');
  } catch (error) {
    next(error);
  }
};

export const transitionAdminAkinatorStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await akinatorService.transitionWorkflowStatus(req.params.id, req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, updated, 'Chuyển trạng thái xử lý hồ sơ Akinator thành công');
  } catch (error) {
    next(error);
  }
};

export const checkAkinatorDuplicateCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await akinatorService.checkDuplicateCustomerForSession(req.params.id);
    sendSuccess(res, result, 'Kiểm tra khách hàng trùng số điện thoại');
  } catch (error) {
    next(error);
  }
};

export const transferAkinatorSessionToCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await akinatorService.transferSessionToCustomer(req.params.id, req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, result, result.message || 'Chuyển hồ sơ Akinator sang Khách hàng thành công');
  } catch (error) {
    next(error);
  }
};
