import { Router } from 'express';
import {
  getAssessmentById,
  saveAssessmentAnswers,
  completeAssessment,
  cancelAssessment,
} from '../controllers/assessment.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  assessmentIdParamSchema,
  saveAssessmentAnswersSchema,
  completeAssessmentSchema,
} from '../validations/assessment.validation.js';

const router = Router();

router.get(
  '/:assessmentId',
  validateRequest({ params: assessmentIdParamSchema }),
  getAssessmentById
);

router.put(
  '/:assessmentId/answers',
  validateRequest({
    params: assessmentIdParamSchema,
    body: saveAssessmentAnswersSchema,
  }),
  saveAssessmentAnswers
);

router.post(
  '/:assessmentId/complete',
  validateRequest({
    params: assessmentIdParamSchema,
    body: completeAssessmentSchema,
  }),
  completeAssessment
);

router.post(
  '/:assessmentId/cancel',
  validateRequest({ params: assessmentIdParamSchema }),
  cancelAssessment
);

export default router;
