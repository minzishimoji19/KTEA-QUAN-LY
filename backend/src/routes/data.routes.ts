import { Router } from 'express';
import { getDataStatus, exportData } from '../controllers/settings.controller.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/status', getDataStatus);
router.get('/export', exportData);

export default router;
