import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addCustomerTag,
  removeCustomerTag,
  exportCustomers,
} from '../controllers/customer.controller.js';
import { executeBulkAction } from '../controllers/bulkAction.controller.js';
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
  exportCustomersSchema,
} from '../validations/customer.validation.js';
import { bulkActionSchema } from '../validations/bulkAction.validation.js';
import { createCaseSchema } from '../validations/case.validation.js';
import { createNeedSchema } from '../validations/need.validation.js';
import { createActivitySchema } from '../validations/activity.validation.js';
import { createNoteSchema } from '../validations/note.validation.js';
import { createPushRecordSchema } from '../validations/pushRecord.validation.js';
import {
  getAssessmentsByCustomer,
  startAssessment,
} from '../controllers/assessment.controller.js';
import { createAssessmentSchema } from '../validations/assessment.validation.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Primary Customer Endpoints
router.get(
  '/',
  validateRequest({ query: listCustomersQuerySchema }),
  getCustomers
);

router.post(
  '/',
  requireAdmin,
  validateRequest({ body: createCustomerSchema }),
  createCustomer
);

// Bulk Customer Action Endpoint
router.post(
  '/bulk-action',
  requireAdmin,
  validateRequest({ body: bulkActionSchema }),
  executeBulkAction
);

// Export Customers to Excel
router.get(
  '/export',
  validateRequest({ query: exportCustomersSchema }),
  exportCustomers
);

router.post(
  '/export',
  validateRequest({ body: exportCustomersSchema }),
  exportCustomers
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
  requireAdmin,
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

// Nested Sub-Resource Endpoints: Assessments (Phase 3)
router.get(
  '/:id/assessments',
  validateRequest({ params: customerIdParamSchema }),
  getAssessmentsByCustomer
);

router.post(
  '/:id/assessments',
  validateRequest({ params: customerIdParamSchema, body: createAssessmentSchema }),
  startAssessment
);

export default router;
