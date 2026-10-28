import { Request, Response, NextFunction } from 'express';
import { questionnaireService } from '../services/questionnaire.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export const getQuestionnaires = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activeOnly = req.query.active === 'true';
    const questionnaires = await questionnaireService.getAllQuestionnaires(activeOnly);
    sendSuccess(res, questionnaires, 'Danh sách bộ câu hỏi');
  } catch (error) {
    next(error);
  }
};

export const getQuestionnaireById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const questionnaire = await questionnaireService.getQuestionnaireById(req.params.id);
    sendSuccess(res, questionnaire, 'Chi tiết bộ câu hỏi');
  } catch (error) {
    next(error);
  }
};

export const createQuestionnaire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userEmail = req.user?.email || 'admin@ktea.vn';
    const questionnaire = await questionnaireService.createQuestionnaire({
      ...req.body,
      createdBy: userEmail,
    });
    sendCreated(res, questionnaire, 'Tạo bộ câu hỏi mới thành công');
  } catch (error) {
    next(error);
  }
};

export const updateQuestionnaire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await questionnaireService.updateQuestionnaire(req.params.id, req.body, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, updated, 'Cập nhật thông tin bộ câu hỏi thành công');
  } catch (error) {
    next(error);
  }
};

export const deleteQuestionnaire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await questionnaireService.deleteQuestionnaire(req.params.id, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, { id: req.params.id }, 'Đã xóa bộ câu hỏi nháp thành công');
  } catch (error) {
    next(error);
  }
};

export const getVersionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const version = await questionnaireService.getVersionById(req.params.id, req.params.versionId);
    sendSuccess(res, version, 'Chi tiết phiên bản câu hỏi');
  } catch (error) {
    next(error);
  }
};

export const getCurrentPublishedVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const version = await questionnaireService.getCurrentPublishedVersion(req.params.id);
    sendSuccess(res, version, 'Phiên bản câu hỏi hiện hành');
  } catch (error) {
    next(error);
  }
};

export const createDraftVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userEmail = req.user?.email || 'admin@ktea.vn';
    const draft = await questionnaireService.createDraftVersion(
      req.params.id,
      req.body,
      userEmail
    );
    sendCreated(res, draft, 'Tạo bản nháp câu hỏi thành công');
  } catch (error) {
    next(error);
  }
};

export const saveDraftQuestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updatedVersion = await questionnaireService.saveDraftQuestions(
      req.params.id,
      req.params.versionId,
      req.body.questions
    );
    sendSuccess(res, updatedVersion, 'Lưu danh sách câu hỏi bản nháp thành công');
  } catch (error) {
    next(error);
  }
};

export const reorderQuestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reordered = await questionnaireService.reorderQuestions(
      req.params.id,
      req.params.versionId,
      req.body.orders
    );
    sendSuccess(res, reordered, 'Sắp xếp thứ tự câu hỏi thành công');
  } catch (error) {
    next(error);
  }
};

export const validateVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await questionnaireService.validateVersion(req.params.id, req.params.versionId);
    sendSuccess(res, result, 'Kiểm tra tính hợp lệ của phiên bản');
  } catch (error) {
    next(error);
  }
};

export const publishVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userEmail = req.user?.email || 'admin@ktea.vn';
    const published = await questionnaireService.publishVersion(
      req.params.id,
      req.params.versionId,
      userEmail,
      req.body.changeLog
    );
    sendSuccess(res, published, 'Xuất bản phiên bản câu hỏi thành công');
  } catch (error) {
    next(error);
  }
};

export const deleteDraftVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await questionnaireService.deleteDraftVersion(req.params.id, req.params.versionId, {
      userId: req.user?.userId,
      email: req.user?.email,
    });
    sendSuccess(res, { versionId: req.params.versionId }, 'Xóa bản nháp thành công');
  } catch (error) {
    next(error);
  }
};
