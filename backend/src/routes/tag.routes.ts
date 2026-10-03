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

const router = Router();

router.get('/', getTags);

router.post(
  '/',
  validateRequest({ body: createTagSchema }),
  createTag
);

router.patch(
  '/:id',
  validateRequest({ params: tagIdParamSchema, body: updateTagSchema }),
  updateTag
);

router.delete(
  '/:id',
  validateRequest({ params: tagIdParamSchema }),
  deleteTag
);

export default router;
