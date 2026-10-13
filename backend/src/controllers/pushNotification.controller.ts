import { Request, Response } from 'express';
import { pushNotificationService } from '../services/pushNotification.service.js';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';

export const getVapidPublicKey = async (_req: Request, res: Response): Promise<void> => {
  const publicKey = pushNotificationService.getPublicKey();
  sendSuccess(res, { publicKey });
};

export const subscribeDevice = async (req: Request, res: Response): Promise<void> => {
  const { recipient, subscription, deviceName, userAgent, passkey } = req.body;
  const result = await pushNotificationService.registerSubscription({
    recipient,
    subscription,
    deviceName,
    userAgent,
    passkey,
  });
  sendSuccess(res, result, 'Đăng ký nhận thông báo đẩy thành công', 201);
};

export const unsubscribeDevice = async (req: Request, res: Response): Promise<void> => {
  const { endpoint } = req.body;
  const result = await pushNotificationService.unregisterSubscription(endpoint);
  sendSuccess(res, result, 'Hủy đăng ký thiết bị thành công', 200);
};

export const getSubscriptions = async (req: Request, res: Response): Promise<void> => {
  const { recipient, passkey } = req.body;
  const devices = await pushNotificationService.getSubscriptionsForRecipient(recipient, passkey);
  sendSuccess(res, devices);
};

export const sendTestPush = async (req: Request, res: Response): Promise<void> => {
  const { recipient, passkey } = req.body;
  const result = await pushNotificationService.sendTestNotification(recipient, passkey);
  sendSuccess(res, result, 'Đã gửi thông báo thử nghiệm', 200);
};

export const runCronWorker = async (req: Request, res: Response): Promise<void> => {
  // Allow authorization via x-cron-secret header or passkey body
  const cronSecret = req.headers['x-cron-secret'] || req.query.secret;
  const passkey = req.body?.passkey;

  const isCronAuthorized = cronSecret && cronSecret === env.CRON_SECRET;
  const isPasskeyAuthorized = passkey && passkey === env.PUSH_AUTH_PASSKEY;

  if (!isCronAuthorized && !isPasskeyAuthorized && env.NODE_ENV === 'production') {
    throw new UnauthorizedError('Unauthorized cron execution request');
  }

  const result = await pushNotificationService.checkAndSendDueReminders();
  sendSuccess(res, result, 'Đã chạy kiểm tra nhắc lịch chăm sóc khách hàng', 200);
};

