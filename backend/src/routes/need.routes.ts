import { Router } from 'express';
import { updateNeed, deleteNeed } from '../controllers/need.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { updateNeedSchema, needIdParamSchema } from '../validations/need.validation.js';

const router = Router();

router.patch(
  '/:id',
  validateRequest({ params: needIdParamSchema, body: updateNeedSchema }),
  updateNeed
);

router.delete(
  '/:id',
  validateRequest({ params: needIdParamSchema }),
  deleteNeed
);

export default router;
