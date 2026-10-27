/**
 * publicSurvey.routes.ts
 * Staff routes: POST /customers/:customerId/survey-links
 *              GET /customers/:customerId/survey-links
 *              GET /survey-links/:linkId
 *              POST /survey-links/:linkId/revoke
 *
 * Public routes (no auth): GET /api/public/survey/:token
 *                          POST /api/public/survey/:token/answers
 *                          POST /api/public/survey/:token/complete
 *
 * Note: Public routes are mounted in app.ts BEFORE requireAuth.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createPublicSurveyLink,
  listPublicSurveyLinks,
  getPublicSurveyLink,
  revokePublicSurveyLink,
  getPublicSurveyData,
  publicSaveAnswers,
  publicCompleteAssessment,
} from '../controllers/publicSurvey.controller.js';

// Strict rate limit for public survey endpoints (per IP): 60 req/min
const publicSurveyLimiter = rateLimit({
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

// ---- Staff routes (require auth, mounted at /api) ----
export const staffSurveyRouter = Router({ mergeParams: true });

// POST /api/customers/:customerId/survey-links
// GET /api/customers/:customerId/survey-links
staffSurveyRouter
  .route('/')
  .post(createPublicSurveyLink)
  .get(listPublicSurveyLinks);

// ---- Staff link management (mounted at /api) ----
export const surveyLinkManagementRouter = Router();

// GET /api/survey-links/:linkId
surveyLinkManagementRouter.get('/:linkId', getPublicSurveyLink);

// POST /api/survey-links/:linkId/revoke
surveyLinkManagementRouter.post('/:linkId/revoke', revokePublicSurveyLink);

// ---- Public routes (no auth) ----
export const publicSurveyRouter = Router();

publicSurveyRouter.use(publicSurveyLimiter);

// GET /api/public/survey/:token
publicSurveyRouter.get('/:token', getPublicSurveyData);

// POST /api/public/survey/:token/answers
publicSurveyRouter.post('/:token/answers', publicSaveAnswers);

// POST /api/public/survey/:token/complete
publicSurveyRouter.post('/:token/complete', publicCompleteAssessment);
