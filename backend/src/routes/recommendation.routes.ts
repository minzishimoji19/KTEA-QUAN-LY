import { Router } from 'express';
import {
  getAllRecommendations,
  getRecommendationById,
  generateRecommendations,
  reviewRecommendation,
  dismissRecommendation,
  convertToPush,
} from '../controllers/recommendation.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  listRecommendationsQuerySchema,
  generateRecommendationsSchema,
  convertToPushSchema,
  recommendationIdParamSchema,
} from '../validations/recommendation.validation.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listRecommendationsQuerySchema }),
  getAllRecommendations
);

router.post(
  '/generate',
  validateRequest({ body: generateRecommendationsSchema }),
  generateRecommendations
);

router.get(
  '/:id',
  validateRequest({ params: recommendationIdParamSchema }),
  getRecommendationById
);

router.patch(
  '/:id/review',
  validateRequest({ params: recommendationIdParamSchema }),
  reviewRecommendation
);

router.patch(
  '/:id/dismiss',
  validateRequest({ params: recommendationIdParamSchema }),
  dismissRecommendation
);

router.post(
  '/:id/push',
  validateRequest({
    params: recommendationIdParamSchema,
    body: convertToPushSchema,
  }),
  convertToPush
);

export default router;
