import { Router } from 'express';
import {
  getOverview,
  getCustomerAnalytics,
  getCaseAnalytics,
  getNeedAnalytics,
  getPushAnalytics,
} from '../controllers/analytics.controller.js';
import { validateRequest } from '../middleware/validate.js';
import { analyticsFilterQuerySchema } from '../validations/analytics.validation.js';

const router = Router();

router.get(
  '/overview',
  validateRequest({ query: analyticsFilterQuerySchema }),
  getOverview
);

router.get(
  '/customers',
  validateRequest({ query: analyticsFilterQuerySchema }),
  getCustomerAnalytics
);

router.get(
  '/cases',
  validateRequest({ query: analyticsFilterQuerySchema }),
  getCaseAnalytics
);

router.get(
  '/needs',
  validateRequest({ query: analyticsFilterQuerySchema }),
  getNeedAnalytics
);

router.get(
  '/push',
  validateRequest({ query: analyticsFilterQuerySchema }),
  getPushAnalytics
);

export default router;
