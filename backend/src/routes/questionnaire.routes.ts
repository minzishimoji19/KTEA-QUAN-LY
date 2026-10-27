import { Router } from 'express';
import {
  getQuestionnaires,
  getQuestionnaireById,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  getVersionById,
  getCurrentPublishedVersion,
  createDraftVersion,
  saveDraftQuestions,
  reorderQuestions,
  validateVersion,
  publishVersion,
  deleteDraftVersion,
} from '../controllers/questionnaire.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  createQuestionnaireSchema,
  updateQuestionnaireSchema,
  createDraftVersionSchema,
  saveDraftQuestionsSchema,
  reorderQuestionsSchema,
  publishVersionSchema,
  questionnaireIdParamSchema,
  versionIdParamSchema,
} from '../validations/questionnaire.validation.js';

const router = Router();

// 1. Questionnaire collection & metadata
router.get('/', getQuestionnaires);

router.get(
  '/:id',
  validateRequest({ params: questionnaireIdParamSchema }),
  getQuestionnaireById
);

router.post(
  '/',
  requireAdmin,
  validateRequest({ body: createQuestionnaireSchema }),
  createQuestionnaire
);

router.patch(
  '/:id',
  requireAdmin,
  validateRequest({ params: questionnaireIdParamSchema, body: updateQuestionnaireSchema }),
  updateQuestionnaire
);

router.delete(
  '/:id',
  requireAdmin,
  validateRequest({ params: questionnaireIdParamSchema }),
  deleteQuestionnaire
);

// 2. Published & Version queries
router.get(
  '/:id/current',
  validateRequest({ params: questionnaireIdParamSchema }),
  getCurrentPublishedVersion
);

router.get(
  '/:id/versions/:versionId',
  validateRequest({ params: versionIdParamSchema }),
  getVersionById
);

// 3. Draft & Question authoring (ADMIN ONLY)
router.post(
  '/:id/versions/draft',
  requireAdmin,
  validateRequest({ params: questionnaireIdParamSchema, body: createDraftVersionSchema }),
  createDraftVersion
);

router.put(
  '/:id/versions/:versionId/questions',
  requireAdmin,
  validateRequest({ params: versionIdParamSchema, body: saveDraftQuestionsSchema }),
  saveDraftQuestions
);

router.patch(
  '/:id/versions/:versionId/reorder',
  requireAdmin,
  validateRequest({ params: versionIdParamSchema, body: reorderQuestionsSchema }),
  reorderQuestions
);

router.post(
  '/:id/versions/:versionId/validate',
  requireAdmin,
  validateRequest({ params: versionIdParamSchema }),
  validateVersion
);

router.post(
  '/:id/versions/:versionId/publish',
  requireAdmin,
  validateRequest({ params: versionIdParamSchema, body: publishVersionSchema }),
  publishVersion
);

router.delete(
  '/:id/versions/:versionId',
  requireAdmin,
  validateRequest({ params: versionIdParamSchema }),
  deleteDraftVersion
);

export default router;
