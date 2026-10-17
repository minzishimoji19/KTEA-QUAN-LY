import { Router } from 'express';
import {
  getVapidPublicKey,
  subscribeDevice,
  unsubscribeDevice,
  getSubscriptions,
  sendTestPush,
  runCronWorker,
} from '../controllers/pushNotification.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', requireAuth, subscribeDevice);
router.post('/unsubscribe', requireAuth, unsubscribeDevice);
router.get('/subscriptions', requireAuth, getSubscriptions);
router.post('/subscriptions', requireAuth, getSubscriptions);
router.post('/test', requireAuth, sendTestPush);
router.post('/cron-worker', runCronWorker);
router.get('/cron-worker', runCronWorker); // Allow GET for simple webhook pingers like cron-job.org / UptimeRobot

export default router;
