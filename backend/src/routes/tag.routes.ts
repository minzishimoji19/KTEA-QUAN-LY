import { Router } from 'express';
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
} from '../controllers/tag.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createTagSchema,
  updateTagSchema,
  tagIdParamSchema,
} from '../validations/tag.validation.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getTags);

router.post(
  '/',
  requireAdmin,
  validateRequest({ body: createTagSchema }),
  createTag
);

router.patch(
  '/:id',
  requireAdmin,
  validateRequest({ params: tagIdParamSchema, body: updateTagSchema }),
  updateTag
);

router.delete(
  '/:id',
  requireAdmin,
  validateRequest({ params: tagIdParamSchema }),
  deleteTag
);

export default router;
