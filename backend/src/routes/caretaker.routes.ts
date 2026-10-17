import { Router } from 'express';
import {
  getCaretakers,
  getAvailablePartners,
  getCaretakerById,
  createCaretaker,
  updateCaretaker,
  deleteCaretaker,
  linkCaretaker,
  unlinkCaretaker,
  getBackfillPreview,
  backfillCaretaker,
  backfillAllCaretakers,
} from '../controllers/caretaker.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  listCaretakersQuerySchema,
  createCaretakerSchema,
  updateCaretakerSchema,
  linkCaretakerSchema,
  caretakerIdParamSchema,
} from '../validations/caretaker.validation.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listCaretakersQuerySchema }),
  getCaretakers
);

// Admin-only route to list PARTNER accounts for caregiver linking
router.get(
  '/available-partners',
  requireAdmin,
  getAvailablePartners
);

// Admin-only backfill preview and batch endpoints
router.get(
  '/backfill-preview',
  requireAdmin,
  getBackfillPreview
);

router.post(
  '/backfill-all',
  requireAdmin,
  backfillAllCaretakers
);

router.post(
  '/:id/backfill',
  requireAdmin,
  validateRequest({ params: caretakerIdParamSchema }),
  backfillCaretaker
);

// Admin-only linking and unlinking endpoints
router.post(
  '/:id/link',
  requireAdmin,
  validateRequest({ params: caretakerIdParamSchema, body: linkCaretakerSchema }),
  linkCaretaker
);

router.post(
  '/:id/unlink',
  requireAdmin,
  validateRequest({ params: caretakerIdParamSchema }),
  unlinkCaretaker
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
