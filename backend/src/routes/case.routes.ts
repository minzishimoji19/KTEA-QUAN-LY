import { Router } from 'express';
import {
  getCaseById,
  updateCase,
  deleteCase,
  selectProduct,
  updateProgress,
  rejectCase,
} from '../controllers/case.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  updateCaseSchema,
  caseIdParamSchema,
  selectProductSchema,
  updateProgressSchema,
  rejectCaseSchema,
} from '../validations/case.validation.js';

const router = Router();

router.get(
  '/:id',
  validateRequest({ params: caseIdParamSchema }),
  getCaseById
);

router.patch(
  '/:id/product',
  validateRequest({ params: caseIdParamSchema, body: selectProductSchema }),
  selectProduct
);

router.patch(
  '/:id/progress',
  validateRequest({ params: caseIdParamSchema, body: updateProgressSchema }),
  updateProgress
);

router.post(
  '/:id/reject',
  validateRequest({ params: caseIdParamSchema, body: rejectCaseSchema }),
  rejectCase
);

router.patch(
  '/:id',
  validateRequest({ params: caseIdParamSchema, body: updateCaseSchema }),
  updateCase
);

router.delete(
  '/:id',
  validateRequest({ params: caseIdParamSchema }),
  deleteCase
);

export default router;

