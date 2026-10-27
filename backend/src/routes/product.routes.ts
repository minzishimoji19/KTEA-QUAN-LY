import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
} from '../validations/product.validation.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getProducts);

router.get(
  '/:id',
  validateRequest({ params: productIdParamSchema }),
  getProductById
);

router.post(
  '/',
  requireAdmin,
  validateRequest({ body: createProductSchema }),
  createProduct
);

router.patch(
  '/:id',
  requireAdmin,
  validateRequest({ params: productIdParamSchema, body: updateProductSchema }),
  updateProduct
);

router.delete(
  '/:id',
  requireAdmin,
  validateRequest({ params: productIdParamSchema }),
  deleteProduct
);

export default router;
