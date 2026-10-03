import { Router } from 'express';
import {
  getSettings,
  updateGeneralSettings,
  updateNeedCategories,
  updateStatusSettings,
  updateRecommendationSettings,
} from '../controllers/settings.controller.js';

const router = Router();

router.get('/', getSettings);
router.patch('/general', updateGeneralSettings);
router.patch('/needs', updateNeedCategories);
router.patch('/statuses', updateStatusSettings);
router.patch('/recommendations', updateRecommendationSettings);

export default router;
