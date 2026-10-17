import { Router } from 'express';
import {
  getSettings,
  updateGeneralSettings,
  updateNeedCategories,
  deleteNeedCategory,
  updateStatusSettings,
  updateRecommendationSettings,
} from '../controllers/settings.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', getSettings);
router.patch('/general', requireAdmin, updateGeneralSettings);
router.patch('/needs', requireAdmin, updateNeedCategories);
router.delete('/needs/:code', requireAdmin, deleteNeedCategory);
router.patch('/statuses', requireAdmin, updateStatusSettings);
router.patch('/recommendations', requireAdmin, updateRecommendationSettings);

export default router;
