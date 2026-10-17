import { Router } from 'express';
import {
  getCustomerSources,
  getCustomerSourceById,
  createCustomerSource,
  updateCustomerSource,
  deleteCustomerSource,
} from '../controllers/customerSource.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createCustomerSourceSchema,
  updateCustomerSourceSchema,
  customerSourceIdParamSchema,
  listCustomerSourcesQuerySchema,
} from '../validations/customerSource.validation.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listCustomerSourcesQuerySchema }),
  getCustomerSources
);

router.post(
  '/',
  requireAdmin,
  validateRequest({ body: createCustomerSourceSchema }),
  createCustomerSource
);

router.get(
  '/:id',
  validateRequest({ params: customerSourceIdParamSchema }),
  getCustomerSourceById
);

router.patch(
  '/:id',
  requireAdmin,
  validateRequest({
    params: customerSourceIdParamSchema,
    body: updateCustomerSourceSchema,
  }),
  updateCustomerSource
);

router.delete(
  '/:id',
  requireAdmin,
  validateRequest({ params: customerSourceIdParamSchema }),
  deleteCustomerSource
);

export default router;
