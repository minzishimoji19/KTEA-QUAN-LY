import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerTag,
  removeCustomerTag,
} from '../controllers/customer.controller.js';
import {
  getCasesByCustomer,
  createCase,
} from '../controllers/case.controller.js';
import {
  getNeedsByCustomer,
  createNeed,
} from '../controllers/need.controller.js';
import {
  getActivitiesByCustomer,
  createActivity,
} from '../controllers/activity.controller.js';
import {
  getNotesByCustomer,
  createNote,
} from '../controllers/note.controller.js';
import {
  getPushRecordsByCustomer,
  createPushRecord,
} from '../controllers/pushRecord.controller.js';
import {
  getRecommendationsByCustomer,
} from '../controllers/recommendation.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  listCustomersQuerySchema,
  createCustomerSchema,
  updateCustomerSchema,
  customerIdParamSchema,
  customerTagParamSchema,
} from '../validations/customer.validation.js';
import { createCaseSchema } from '../validations/case.validation.js';
import { createNeedSchema } from '../validations/need.validation.js';
import { createActivitySchema } from '../validations/activity.validation.js';
import { createNoteSchema } from '../validations/note.validation.js';
import { createPushRecordSchema } from '../validations/pushRecord.validation.js';

const router = Router();

// Primary Customer Endpoints
router.get(
  '/',
  validateRequest({ query: listCustomersQuerySchema }),
  getCustomers
);

router.post(
  '/',
  validateRequest({ body: createCustomerSchema }),
  createCustomer
);

router.get(
  '/:id',
  validateRequest({ params: customerIdParamSchema }),
  getCustomerById
);

router.patch(
  '/:id',
  validateRequest({ params: customerIdParamSchema, body: updateCustomerSchema }),
  updateCustomer
);

router.delete(
  '/:id',
  validateRequest({ params: customerIdParamSchema }),
  deleteCustomer
);

// Customer Tag Association Endpoints
router.post(
  '/:id/tags/:tagId',
  validateRequest({ params: customerTagParamSchema }),
  addCustomerTag
);

router.delete(
  '/:id/tags/:tagId',
  validateRequest({ params: customerTagParamSchema }),
  removeCustomerTag
);

// Nested Sub-Resource Endpoints: Cases
router.get(
  '/:id/cases',
  validateRequest({ params: customerIdParamSchema }),
  getCasesByCustomer
);

router.post(
  '/:id/cases',
  validateRequest({ params: customerIdParamSchema, body: createCaseSchema }),
  createCase
);

// Nested Sub-Resource Endpoints: Needs
router.get(
  '/:id/needs',
  validateRequest({ params: customerIdParamSchema }),
  getNeedsByCustomer
);

router.post(
  '/:id/needs',
  validateRequest({ params: customerIdParamSchema, body: createNeedSchema }),
  createNeed
);

// Nested Sub-Resource Endpoints: Activities (Append-only)
router.get(
  '/:id/activities',
  validateRequest({ params: customerIdParamSchema }),
  getActivitiesByCustomer
);

router.post(
  '/:id/activities',
  validateRequest({ params: customerIdParamSchema, body: createActivitySchema }),
  createActivity
);

// Nested Sub-Resource Endpoints: Notes
router.get(
  '/:id/notes',
  validateRequest({ params: customerIdParamSchema }),
  getNotesByCustomer
);

router.post(
  '/:id/notes',
  validateRequest({ params: customerIdParamSchema, body: createNoteSchema }),
  createNote
);

// Nested Sub-Resource Endpoints: Push Records
router.get(
  '/:id/push-records',
  validateRequest({ params: customerIdParamSchema }),
  getPushRecordsByCustomer
);

router.post(
  '/:id/push-records',
  validateRequest({ params: customerIdParamSchema, body: createPushRecordSchema }),
  createPushRecord
);

// Nested Sub-Resource Endpoints: Recommendations
router.get(
  '/:id/recommendations',
  validateRequest({ params: customerIdParamSchema }),
  getRecommendationsByCustomer
);

export default router;
