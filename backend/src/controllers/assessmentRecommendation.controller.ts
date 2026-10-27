import { Request, Response, NextFunction } from 'express';
import { assessmentRecommendationService, UserContext } from '../services/assessmentRecommendation.service.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

function extractUser(req: Request): UserContext {
  return {
    id: req.user!.userId,
    role: req.user!.role,
    email: req.user!.email,
  };
}

export const assessmentRecommendationController = {
  // POST /api/assessments/:assessmentId/recommendations
  async generateForAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { assessmentId } = req.params;
      const { notes, ruleVersionId } = req.body || {};

      const result = await assessmentRecommendationService.generateForAssessment(assessmentId, user, {
        notes,
        ruleVersionId,
      });

      sendCreated(res, result, 'Đã hoàn tất tính toán gợi ý sản phẩm phù hợp theo khảo sát');
    } catch (error) {
      next(error);
    }
  },

  // GET /api/customers/:id/recommendation-runs
  async getRunsByCustomerId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { id } = req.params;

      const runs = await assessmentRecommendationService.getRunsByCustomerId(id, user);

      sendSuccess(res, runs, 'Lịch sử các lượt gợi ý sản phẩm của khách hàng');
    } catch (error) {
      next(error);
    }
  },

  // GET /api/assessments/:assessmentId/recommendation-runs
  async getRunsByAssessmentId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { assessmentId } = req.params;

      const runs = await assessmentRecommendationService.getRunsByAssessmentId(assessmentId, user);

      sendSuccess(res, runs, 'Danh sách các lượt gợi ý cho đợt khảo sát');
    } catch (error) {
      next(error);
    }
  },

  // GET /api/recommendation-runs/:runId
  async getRunById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { runId } = req.params;

      const run = await assessmentRecommendationService.getRunById(runId, user);

      sendSuccess(res, run, 'Chi tiết lượt gợi ý sản phẩm');
    } catch (error) {
      next(error);
    }
  },

  // =========================================================================
  // ADMIN RULE MANAGEMENT
  // =========================================================================

  // GET /api/recommendation-rules
  async getAllRuleSets(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ruleSets = await assessmentRecommendationService.getAllRuleSets();
      sendSuccess(res, ruleSets, 'Danh sách bộ quy tắc gợi ý sản phẩm');
    } catch (error) {
      next(error);
    }
  },

  // GET /api/recommendation-rules/:id
  async getRuleSetById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const ruleSet = await assessmentRecommendationService.getRuleSetById(id);
      sendSuccess(res, ruleSet, 'Chi tiết bộ quy tắc');
    } catch (error) {
      next(error);
    }
  },

  // POST /api/recommendation-rules
  async createRuleSet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, title, description } = req.body;
      const newSet = await assessmentRecommendationService.createRuleSet({ code, title, description });
      sendCreated(res, newSet, 'Tạo bộ quy tắc gợi ý sản phẩm thành công');
    } catch (error) {
      next(error);
    }
  },

  // POST /api/recommendation-rules/:id/versions
  async createRuleVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { id } = req.params;
      const { rules, changeLog } = req.body;

      const newVersion = await assessmentRecommendationService.createRuleVersion({
        ruleSetId: id,
        rules,
        changeLog,
        createdBy: user.email || user.id,
      });

      sendCreated(res, newVersion, 'Tạo bản nháp phiên bản quy tắc mới thành công');
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/recommendation-rules/versions/:versionId
  async updateRuleVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { versionId } = req.params;
      const { rules, changeLog } = req.body;

      const updated = await assessmentRecommendationService.updateRuleVersion(versionId, user, {
        rules,
        changeLog,
      });

      sendSuccess(res, updated, 'Cập nhật bản nháp phiên bản quy tắc thành công');
    } catch (error) {
      next(error);
    }
  },

  // POST /api/recommendation-rules/versions/:versionId/simulate
  async simulateRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { versionId } = req.params;
      const { answers } = req.body;

      const result = await assessmentRecommendationService.simulateRecommendations(
        versionId,
        user,
        answers || {}
      );

      sendSuccess(res, result, 'Mô phỏng tính toán gợi ý thành công');
    } catch (error) {
      next(error);
    }
  },

  // POST /api/recommendation-rules/versions/:versionId/publish
  async publishRuleVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = extractUser(req);
      const { versionId } = req.params;

      const published = await assessmentRecommendationService.publishRuleVersion(
        versionId,
        user.email || user.id
      );

      sendSuccess(res, published, 'Đã xuất bản phiên bản quy tắc gợi ý sản phẩm chính thức');
    } catch (error) {
      next(error);
    }
  },
};
