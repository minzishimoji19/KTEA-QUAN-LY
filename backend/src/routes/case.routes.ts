import { Router } from 'express';
import { updateCase, deleteCase } from '../controllers/case.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { updateCaseSchema, caseIdParamSchema } from '../validations/case.validation.js';

const router = Router();

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
