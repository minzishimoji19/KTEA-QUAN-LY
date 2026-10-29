/**
 * akinator.routes.ts
 *
 * Dedicated API namespace for the independent Akinator module:
 * - Public Quiz Endpoints (no CRM auth, token-scoped, rate-limited):
 *   Mounted at `/api/public/akinator`
 * - Admin Management & Workflow Endpoints (`requireAuth` + `requireAdmin`):
 *   Mounted at `/api/akinator`
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  listAkinatorConfigs,
  getCurrentPublishedAkinatorConfig,
  getAkinatorConfigById,
  createAkinatorDraftConfig,
  updateAkinatorDraftMetadata,
  saveAkinatorDraftQuestions,
  saveAkinatorDraftRules,
  validateAkinatorConfigVersion,
  publishAkinatorConfigVersion,
  startPublicAkinatorSession,
  getPublicAkinatorSession,
  submitPublicAkinatorAnswer,
  completePublicAkinatorSession,
  listAdminAkinatorSessions,
  getAdminAkinatorSessionDetail,
  updateAdminAkinatorReview,
  transitionAdminAkinatorStatus,
  checkAkinatorDuplicateCustomer,
  transferAkinatorSessionToCustomer,
} from '../controllers/akinator.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  createDraftConfigSchema,
  updateDraftMetadataSchema,
  saveDraftQuestionsSchema,
  saveDraftRulesSchema,
  publishConfigSchema,
  configVersionIdParamSchema,
  listConfigsQuerySchema,
  sessionTokenParamSchema,
  submitQuizAnswerSchema,
  sessionIdParamSchema,
  listAkinatorSessionsQuerySchema,
  updateAdminReviewSchema,
  transitionWorkflowStatusSchema,
  transferAkinatorSessionSchema,
} from '../validations/akinator.validation.js';

// Rate limit for public Akinator quiz endpoints: 60 req/min/IP
const publicAkinatorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.',
    },
  },
});

// =========================================================================
// PUBLIC AKINATOR QUIZ ROUTER (`/api/public/akinator`)
// =========================================================================

export const publicAkinatorRouter = Router();

publicAkinatorRouter.use(publicAkinatorLimiter);

// POST /api/public/akinator/sessions
publicAkinatorRouter.post('/sessions', startPublicAkinatorSession);

// GET /api/public/akinator/sessions/:token
publicAkinatorRouter.get(
  '/sessions/:token',
  validateRequest({ params: sessionTokenParamSchema }),
  getPublicAkinatorSession
);

// POST /api/public/akinator/sessions/:token/answers
publicAkinatorRouter.post(
  '/sessions/:token/answers',
  validateRequest({
    params: sessionTokenParamSchema,
    body: submitQuizAnswerSchema,
  }),
  submitPublicAkinatorAnswer
);

// POST /api/public/akinator/sessions/:token/complete
publicAkinatorRouter.post(
  '/sessions/:token/complete',
  validateRequest({ params: sessionTokenParamSchema }),
  completePublicAkinatorSession
);

// =========================================================================
// ADMIN AKINATOR ROUTER (`/api/akinator`, requires `requireAuth` + `requireAdmin`)
// =========================================================================

export const adminAkinatorRouter = Router();

// Enforce ADMIN role across all `/api/akinator/*` endpoints (PARTNER is explicitly denied with 403)
adminAkinatorRouter.use(requireAdmin);

// ---- 1. Configuration Version Management ----

// GET /api/akinator/configs
adminAkinatorRouter.get(
  '/configs',
  validateRequest({ query: listConfigsQuerySchema }),
  listAkinatorConfigs
);

// GET /api/akinator/configs/current
adminAkinatorRouter.get('/configs/current', getCurrentPublishedAkinatorConfig);

// GET /api/akinator/configs/:versionId
adminAkinatorRouter.get(
  '/configs/:versionId',
  validateRequest({ params: configVersionIdParamSchema }),
  getAkinatorConfigById
);

// POST /api/akinator/configs/draft
adminAkinatorRouter.post(
  '/configs/draft',
  validateRequest({ body: createDraftConfigSchema }),
  createAkinatorDraftConfig
);

// PATCH /api/akinator/configs/:versionId
adminAkinatorRouter.patch(
  '/configs/:versionId',
  validateRequest({
    params: configVersionIdParamSchema,
    body: updateDraftMetadataSchema,
  }),
  updateAkinatorDraftMetadata
);

// PUT /api/akinator/configs/:versionId/questions
adminAkinatorRouter.put(
  '/configs/:versionId/questions',
  validateRequest({
    params: configVersionIdParamSchema,
    body: saveDraftQuestionsSchema,
  }),
  saveAkinatorDraftQuestions
);

// PUT /api/akinator/configs/:versionId/rules
adminAkinatorRouter.put(
  '/configs/:versionId/rules',
  validateRequest({
    params: configVersionIdParamSchema,
    body: saveDraftRulesSchema,
  }),
  saveAkinatorDraftRules
);

// POST /api/akinator/configs/:versionId/validate
adminAkinatorRouter.post(
  '/configs/:versionId/validate',
  validateRequest({ params: configVersionIdParamSchema }),
  validateAkinatorConfigVersion
);

// POST /api/akinator/configs/:versionId/publish
adminAkinatorRouter.post(
  '/configs/:versionId/publish',
  validateRequest({
    params: configVersionIdParamSchema,
    body: publishConfigSchema,
  }),
  publishAkinatorConfigVersion
);

// ---- 2. Admin Session Review & Workflow Management ----

// GET /api/akinator/sessions
adminAkinatorRouter.get(
  '/sessions',
  validateRequest({ query: listAkinatorSessionsQuerySchema }),
  listAdminAkinatorSessions
);

// GET /api/akinator/sessions/:id
adminAkinatorRouter.get(
  '/sessions/:id',
  validateRequest({ params: sessionIdParamSchema }),
  getAdminAkinatorSessionDetail
);

// PATCH /api/akinator/sessions/:id/review
adminAkinatorRouter.patch(
  '/sessions/:id/review',
  validateRequest({
    params: sessionIdParamSchema,
    body: updateAdminReviewSchema,
  }),
  updateAdminAkinatorReview
);

// POST /api/akinator/sessions/:id/status
adminAkinatorRouter.post(
  '/sessions/:id/status',
  validateRequest({
    params: sessionIdParamSchema,
    body: transitionWorkflowStatusSchema,
  }),
  transitionAdminAkinatorStatus
);

// GET /api/akinator/sessions/:id/check-duplicate
adminAkinatorRouter.get(
  '/sessions/:id/check-duplicate',
  validateRequest({ params: sessionIdParamSchema }),
  checkAkinatorDuplicateCustomer
);

// POST /api/akinator/sessions/:id/transfer
adminAkinatorRouter.post(
  '/sessions/:id/transfer',
  validateRequest({
    params: sessionIdParamSchema,
    body: transferAkinatorSessionSchema,
  }),
  transferAkinatorSessionToCustomer
);
