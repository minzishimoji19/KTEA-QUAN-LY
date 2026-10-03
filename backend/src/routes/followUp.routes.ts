import { Router } from 'express';
import {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
} from '../controllers/followUp.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  listFollowUpsQuerySchema,
  createFollowUpSchema,
  updateFollowUpSchema,
  followUpIdParamSchema,
} from '../validations/followUp.validation.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listFollowUpsQuerySchema }),
  getFollowUps
);

router.post(
  '/',
  validateRequest({ body: createFollowUpSchema }),
  createFollowUp
);

router.patch(
  '/:id',
  validateRequest({ params: followUpIdParamSchema, body: updateFollowUpSchema }),
  updateFollowUp
);

router.delete(
  '/:id',
  validateRequest({ params: followUpIdParamSchema }),
  deleteFollowUp
);

export default router;
