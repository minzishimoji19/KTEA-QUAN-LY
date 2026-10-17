import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { pushNotificationService } from '../services/pushNotification.service.js';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import prisma from '../config/database.js';

export const getVapidPublicKey = async (_req: Request, res: Response): Promise<void> => {
  const publicKey = pushNotificationService.getPublicKey();
  sendSuccess(res, { publicKey });
};

export const subscribeDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipient, subscription, deviceName, userAgent, passkey } = req.body;

    if (req.user?.role === Role.PARTNER) {
      if (!recipient || (recipient !== req.user.email && recipient !== req.user.fullName)) {
        throw new ForbiddenError('Đối tác không được phép đăng ký thiết bị thông báo dưới danh nghĩa người khác');
      }
    }

    const result = await pushNotificationService.registerSubscription({
      recipient,
      subscription,
      deviceName,
      userAgent,
      passkey,
    });
    sendSuccess(res, result, 'Đăng ký nhận thông báo đẩy thành công', 201);
  } catch (error) {
    next(error);
  }
};

export const unsubscribeDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { endpoint } = req.body;

    if (req.user?.role === Role.PARTNER) {
      const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });
      if (existing && existing.recipient !== req.user.email && existing.recipient !== req.user.fullName) {
        throw new ForbiddenError('Đối tác không được phép hủy thiết bị thông báo của người khác');
      }
    }

    const result = await pushNotificationService.unregisterSubscription(endpoint);
    sendSuccess(res, result, 'Hủy đăng ký thiết bị thành công', 200);
  } catch (error) {
    next(error);
  }
};

export const getSubscriptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recipient = (req.body?.recipient || req.query?.recipient) as string;
    const passkey = (req.body?.passkey || req.query?.passkey || req.headers['x-passkey']) as string;

    if (req.user?.role === Role.PARTNER) {
      if (!recipient || (recipient !== req.user.email && recipient !== req.user.fullName)) {
        throw new ForbiddenError('Đối tác không được phép truy cập hoặc quản lý thiết bị thông báo của người khác');
      }
    }

    if (!recipient || !passkey) {
      sendSuccess(res, []);
      return;
    }

    const devices = await pushNotificationService.getSubscriptionsForRecipient(recipient, passkey);
    sendSuccess(res, devices);
  } catch (error) {
    next(error);
  }
};

export const sendTestPush = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipient, passkey } = req.body;

    if (req.user?.role === Role.PARTNER) {
      if (!recipient || (recipient !== req.user.email && recipient !== req.user.fullName)) {
        throw new ForbiddenError('Đối tác không được phép gửi thông báo tới thiết bị của người khác');
      }
    }

    const result = await pushNotificationService.sendTestNotification(recipient, passkey);
    sendSuccess(res, result, 'Đã gửi thông báo thử nghiệm', 200);
  } catch (error) {
    next(error);
  }
};

export const runCronWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cronSecret = (req.headers['x-cron-secret'] || req.query.secret) as string | undefined;

    if (!env.CRON_SECRET || !cronSecret || cronSecret !== env.CRON_SECRET) {
      throw new UnauthorizedError('Unauthorized cron execution request');
    }

    const result = await pushNotificationService.checkAndSendDueReminders();
    sendSuccess(res, result, 'Đã chạy kiểm tra nhắc lịch chăm sóc khách hàng', 200);
  } catch (error) {
    next(error);
  }
};

