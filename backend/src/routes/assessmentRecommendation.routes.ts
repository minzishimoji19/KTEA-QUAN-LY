import { Router } from 'express';
import { z } from 'zod';
import { assessmentRecommendationController } from '../controllers/assessmentRecommendation.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import {
  runRecommendationSchema,
  runIdParamSchema,
  createRuleSetSchema,
  createRuleVersionSchema,
  updateRuleVersionSchema,
  simulateRecommendationSchema,
} from '../validations/assessmentRecommendation.validation.js';
import { assessmentIdParamSchema } from '../validations/assessment.validation.js';
import { customerIdParamSchema } from '../validations/customer.validation.js';

const router = Router();

const genericIdParamSchema = z.object({
  id: z.string().min(1, 'ID không được để trống'),
});

const versionIdParamSchema = z.object({
  versionId: z.string().min(1, 'versionId không được để trống'),
});

// =========================================================================
// RUNS & RESULTS (Available to Authenticated Users with Customer Access)
// =========================================================================

// Run recommendation on a completed assessment
router.post(
  '/assessments/:assessmentId/recommendations',
  requireAuth,
  validateRequest({
    params: assessmentIdParamSchema,
    body: runRecommendationSchema,
  }),
  assessmentRecommendationController.generateForAssessment
);

// Get all recommendation runs for a completed assessment
router.get(
  '/assessments/:assessmentId/recommendation-runs',
  requireAuth,
  validateRequest({
    params: assessmentIdParamSchema,
  }),
  assessmentRecommendationController.getRunsByAssessmentId
);

// Get recommendation history for a customer
router.get(
  '/customers/:id/recommendation-runs',
  requireAuth,
  validateRequest({
    params: customerIdParamSchema,
  }),
  assessmentRecommendationController.getRunsByCustomerId
);

// Get full details of a specific recommendation run with items and snapshots
router.get(
  '/recommendation-runs/:runId',
  requireAuth,
  validateRequest({
    params: runIdParamSchema,
  }),
  assessmentRecommendationController.getRunById
);

// =========================================================================
// RULE GOVERNANCE (ADMIN ONLY)
// =========================================================================

// List all rule sets and their versions
router.get(
  '/recommendation-rules',
  requireAuth,
  requireAdmin,
  assessmentRecommendationController.getAllRuleSets
);

// Get details of a rule set
router.get(
  '/recommendation-rules/:id',
  requireAuth,
  requireAdmin,
  validateRequest({
    params: genericIdParamSchema,
  }),
  assessmentRecommendationController.getRuleSetById
);

// Create a new rule set
router.post(
  '/recommendation-rules',
  requireAuth,
  requireAdmin,
  validateRequest({
    body: createRuleSetSchema,
  }),
  assessmentRecommendationController.createRuleSet
);

// Create a new draft rule version
router.post(
  '/recommendation-rules/:id/versions',
  requireAuth,
  requireAdmin,
  validateRequest({
    params: genericIdParamSchema,
    body: createRuleVersionSchema,
  }),
  assessmentRecommendationController.createRuleVersion
);

// Update a draft rule version
router.put(
  '/recommendation-rules/versions/:versionId',
  requireAuth,
  requireAdmin,
  validateRequest({
    params: versionIdParamSchema,
    body: updateRuleVersionSchema,
  }),
  assessmentRecommendationController.updateRuleVersion
);

// Simulate / preview recommendations using sample answers against a rule version
router.post(
  '/recommendation-rules/versions/:versionId/simulate',
  requireAuth,
  requireAdmin,
  validateRequest({
    params: versionIdParamSchema,
    body: simulateRecommendationSchema,
  }),
  assessmentRecommendationController.simulateRecommendations
);

// Publish a rule version
router.post(
  '/recommendation-rules/versions/:versionId/publish',
  requireAuth,
  requireAdmin,
  validateRequest({
    params: versionIdParamSchema,
  }),
  assessmentRecommendationController.publishRuleVersion
);

export default router;
