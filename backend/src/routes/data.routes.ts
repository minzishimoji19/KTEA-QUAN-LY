import { Router } from 'express';
import { getDataStatus, exportData } from '../controllers/settings.controller.js';

const router = Router();

router.get('/status', getDataStatus);
router.get('/export', exportData);

export default router;
