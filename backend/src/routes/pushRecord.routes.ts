import { Router } from 'express';
import {
  getAllPushRecords,
  updatePushRecord,
} from '../controllers/pushRecord.controller.js';
import { validateRequest } from '../middleware/validate.js';
import {
  updatePushRecordSchema,
  pushRecordIdParamSchema,
} from '../validations/pushRecord.validation.js';

const router = Router();

router.get('/', getAllPushRecords);

router.patch(
  '/:id',
  validateRequest({ params: pushRecordIdParamSchema, body: updatePushRecordSchema }),
  updatePushRecord
);

export default router;
