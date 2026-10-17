import { Router } from 'express';
import {
  getCaretakers,
  getCaretakerById,
  createCaretaker,
  updateCaretaker,
  deleteCaretaker,
} from '../controllers/caretaker.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  listCaretakersQuerySchema,
  createCaretakerSchema,
  updateCaretakerSchema,
  caretakerIdParamSchema,
} from '../validations/caretaker.validation.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listCaretakersQuerySchema }),
  getCaretakers
);

router.get(
  '/:id',
  validateRequest({ params: caretakerIdParamSchema }),
  getCaretakerById
);

router.post(
  '/',
  requireAdmin,
  validateRequest({ body: createCaretakerSchema }),
  createCaretaker
);

router.patch(
  '/:id',
  requireAdmin,
  validateRequest({ params: caretakerIdParamSchema, body: updateCaretakerSchema }),
  updateCaretaker
);

router.delete(
  '/:id',
  requireAdmin,
  validateRequest({ params: caretakerIdParamSchema }),
  deleteCaretaker
);

export default router;
