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

const router = Router();

router.get(
  '/',
  validateRequest({ query: listCustomerSourcesQuerySchema }),
  getCustomerSources
);

router.post(
  '/',
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
  validateRequest({
    params: customerSourceIdParamSchema,
    body: updateCustomerSourceSchema,
  }),
  updateCustomerSource
);

router.delete(
  '/:id',
  validateRequest({ params: customerSourceIdParamSchema }),
  deleteCustomerSource
);

export default router;
