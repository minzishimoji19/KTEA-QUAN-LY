import { Router } from 'express';
import {
  getFollowUps,
  createFollowUp,
  createBulkFollowUps,
  completeBulkFollowUps,
  reopenBulkFollowUps,
  reassignBulkFollowUps,
  deleteBulkFollowUps,
  updateFollowUp,
  deleteFollowUp,
} from '../controllers/followUp.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  listFollowUpsQuerySchema,
  createFollowUpSchema,
  createBulkFollowUpSchema,
  bulkFollowUpIdsSchema,
  bulkReassignFollowUpsSchema,
  updateFollowUpSchema,
  followUpIdParamSchema,
} from '../validations/followUp.validation.js';

const router = Router();

router.get(
  '/',
  validateRequest({ query: listFollowUpsQuerySchema }),
  getFollowUps
);

router.post(
  '/',
  validateRequest({ body: createFollowUpSchema }),
  createFollowUp
);

router.post(
  '/bulk',
  validateRequest({ body: createBulkFollowUpSchema }),
  createBulkFollowUps
);

router.post(
  '/bulk-complete',
  validateRequest({ body: bulkFollowUpIdsSchema }),
  completeBulkFollowUps
);

router.post(
  '/bulk-reopen',
  validateRequest({ body: bulkFollowUpIdsSchema }),
  reopenBulkFollowUps
);

router.post(
  '/bulk-reassign',
  validateRequest({ body: bulkReassignFollowUpsSchema }),
  reassignBulkFollowUps
);

router.post(
  '/bulk-delete',
  validateRequest({ body: bulkFollowUpIdsSchema }),
  deleteBulkFollowUps
);

router.patch(
  '/:id',
  validateRequest({ params: followUpIdParamSchema, body: updateFollowUpSchema }),
  updateFollowUp
);

router.delete(
  '/:id',
  validateRequest({ params: followUpIdParamSchema }),
  deleteFollowUp
);

export default router;
