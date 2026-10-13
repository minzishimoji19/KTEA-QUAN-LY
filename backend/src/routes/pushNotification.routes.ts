import { Router } from 'express';
import {
  getVapidPublicKey,
  subscribeDevice,
  unsubscribeDevice,
  getSubscriptions,
  sendTestPush,
  runCronWorker,
} from '../controllers/pushNotification.controller.js';

const router = Router();

router.get('/vapid-public-key', getVapidPublicKey);
router.post('/subscribe', subscribeDevice);
router.post('/unsubscribe', unsubscribeDevice);
router.get('/subscriptions', getSubscriptions);
router.post('/subscriptions', getSubscriptions);
router.post('/test', sendTestPush);
router.post('/cron-worker', runCronWorker);
router.get('/cron-worker', runCronWorker); // Allow GET for simple webhook pingers like cron-job.org / UptimeRobot

export default router;
