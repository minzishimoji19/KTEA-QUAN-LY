import { Router } from 'express';
import {
  getProducts,
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

const router = Router();

router.get('/', getProducts);

router.post(
  '/',
  validateRequest({ body: createProductSchema }),
  createProduct
);

router.patch(
  '/:id',
  validateRequest({ params: productIdParamSchema, body: updateProductSchema }),
  updateProduct
);

router.delete(
  '/:id',
  validateRequest({ params: productIdParamSchema }),
  deleteProduct
);

export default router;
