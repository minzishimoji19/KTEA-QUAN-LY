import webPush from 'web-push';
import prisma from '../config/database.js';
import { env } from '../config/env.js';
import { FollowUpStatus } from '@prisma/client';
import { BadRequestError, UnauthorizedError } from '../utils/errors.js';

export const OPERATOR_RECIPIENTS = ['Ktea', 'xoaicaldez'] as const;
export type OperatorRecipient = typeof OPERATOR_RECIPIENTS[number];

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    followUpId?: string;
    customerId?: string;
    eventType?: string;
    [key: string]: any;
  };
}

export class PushNotificationService {
  private isConfigured = false;

  constructor() {
    this.initVapid();
  }

  private initVapid() {
    try {
      if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
        webPush.setVapidDetails(
          env.VAPID_SUBJECT,
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY
        );
        this.isConfigured = true;
      } else {
        console.warn('⚠️ Web Push VAPID keys not configured in environment');
      }
    } catch (err) {
      console.error('❌ Failed to initialize VAPID in PushNotificationService:', err);
    }
  }

  getPublicKey(): string {
    return env.VAPID_PUBLIC_KEY;
  }

  verifyPasskey(passkey?: string): boolean {
    if (!passkey) return false;
    return passkey.trim() === env.PUSH_AUTH_PASSKEY.trim();
  }

  /**
   * Format datetime to Asia/Ho_Chi_Minh timezone
   */
  formatDateTimeVN(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    }).format(d);
  }

  /**
   * Register a new or existing push subscription for a specific operator recipient
   */
  async registerSubscription(data: {
    recipient: string;
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    };
    deviceName?: string;
    userAgent?: string;
    passkey: string;
  }) {
    if (!this.verifyPasskey(data.passkey)) {
      throw new UnauthorizedError('Mã kích hoạt thiết bị (passkey) không chính xác');
    }

    const recipient = data.recipient.trim();
    if (!OPERATOR_RECIPIENTS.includes(recipient as any)) {
      throw new BadRequestError(`Người nhận không hợp lệ. Chỉ chấp nhận: ${OPERATOR_RECIPIENTS.join(', ')}`);
    }

    const { endpoint, keys } = data.subscription;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new BadRequestError('Dữ liệu subscription Web Push không đầy đủ');
    }

    const record = await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        recipient,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceName: data.deviceName?.slice(0, 190) || null,
        userAgent: data.userAgent || null,
      },
      update: {
        recipient,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceName: data.deviceName?.slice(0, 190) || undefined,
        userAgent: data.userAgent || undefined,
        updatedAt: new Date(),
      },
    });

    return record;
  }

  /**
   * Unsubscribe a specific endpoint
   */
  async unregisterSubscription(endpoint: string) {
    if (!endpoint) return { success: true };
    try {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint },
      });
      return { success: true };
    } catch (err) {
      console.error('[WebPush] Error deleting subscription:', err);
      return { success: false };
    }
  }

  /**
   * Get active devices for a recipient
   */
  async getSubscriptionsForRecipient(recipient: string, passkey: string) {
    if (!this.verifyPasskey(passkey)) {
      throw new UnauthorizedError('Mã xác thực không hợp lệ');
    }

    return prisma.pushSubscription.findMany({
      where: { recipient },
      select: {
        id: true,
        recipient: true,
        deviceName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Sends push payload to all devices of specified recipients with idempotency guarantees
   */
  async sendToRecipients(
    recipients: string[],
    payload: PushPayload,
    options?: {
      followUpId?: string;
      eventType?: string;
    }
  ) {
    if (!this.isConfigured) {
      console.warn('[WebPush] Skipped push: VAPID is not configured');
      return { sentCount: 0, failedCount: 0 };
    }

    const { followUpId, eventType } = options || {};
    let totalSent = 0;
    let totalFailed = 0;

    for (const recipient of recipients) {
      // 1. Idempotency Check: if followUpId & eventType provided, check if already sent to this recipient
      if (followUpId && eventType) {
        const existingLog = await prisma.pushNotificationLog.findUnique({
          where: {
            followUpId_eventType_recipient: {
              followUpId,
              eventType,
              recipient,
            },
          },
        });

        if (existingLog && existingLog.status === 'SENT') {
          console.log(`[WebPush] Idempotency: Skip duplicate push for followUpId=${followUpId}, eventType=${eventType}, recipient=${recipient}`);
          continue;
        }
      }

      // 2. Fetch all registered devices for this recipient
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { recipient },
      });

      if (subscriptions.length === 0) {
        console.log(`[WebPush] No active subscriptions found for recipient: ${recipient}`);
        // Log skip/record so we know it was processed
        if (followUpId && eventType) {
          await prisma.pushNotificationLog.upsert({
            where: {
              followUpId_eventType_recipient: { followUpId, eventType, recipient },
            },
            create: {
              followUpId,
              eventType,
              recipient,
              status: 'SENT',
              title: payload.title,
              body: payload.body,
              errorMessage: 'Không có thiết bị đăng ký nhận thông báo',
            },
            update: {
              status: 'SENT',
              errorMessage: 'Không có thiết bị đăng ký nhận thông báo',
            },
          });
        }
        continue;
      }

      const stringifiedPayload = JSON.stringify(payload);
      let recipientSuccessCount = 0;
      let lastErrorMessage: string | null = null;

      for (const sub of subscriptions) {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webPush.sendNotification(pushConfig, stringifiedPayload, {
            TTL: 86400, // 1 day TTL
            urgency: 'high',
          });
          recipientSuccessCount++;
          totalSent++;
        } catch (err: any) {
          totalFailed++;
          const statusCode = err?.statusCode;
          console.warn(`[WebPush] Delivery failed for device ${sub.id} (${recipient}) with status ${statusCode}:`, err?.message || err);
          lastErrorMessage = err?.message || String(err);

          // If subscription is expired or unsubscribed (404 Not Found or 410 Gone), remove it
          if (statusCode === 404 || statusCode === 410) {
            console.log(`[WebPush] Removing expired/unregistered subscription ${sub.id}`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
        }
      }

      // Record log for this recipient
      if (followUpId && eventType) {
        const isOverallSuccess = recipientSuccessCount > 0;
        await prisma.pushNotificationLog.upsert({
          where: {
            followUpId_eventType_recipient: { followUpId, eventType, recipient },
          },
          create: {
            followUpId,
            eventType,
            recipient,
            status: isOverallSuccess ? 'SENT' : 'FAILED',
            title: payload.title,
            body: payload.body,
            errorMessage: isOverallSuccess ? null : lastErrorMessage,
          },
          update: {
            status: isOverallSuccess ? 'SENT' : 'FAILED',
            errorMessage: isOverallSuccess ? null : lastErrorMessage,
            sentAt: new Date(),
          },
        });
      }
    }

    return { sentCount: totalSent, failedCount: totalFailed };
  }

  /**
   * Dispatch notification when one or multiple follow-ups are created
   */
  async notifyNewFollowUps(
    followUps: Array<{
      id: string;
      customerId: string;
      title: string;
      dueAt: Date | string;
      assignedTo?: string | null;
      description?: string | null;
      customer?: { fullName: string; phone: string } | null;
    }>
  ) {
    if (!followUps || followUps.length === 0) return;

    for (const f of followUps) {
      try {
        let customerName = f.customer?.fullName;
        if (!customerName) {
          const cust = await prisma.customer.findUnique({
            where: { id: f.customerId },
            select: { fullName: true },
          });
          customerName = cust?.fullName || 'Khách hàng';
        }

        const dueFormatted = this.formatDateTimeVN(f.dueAt);
        const assigned = f.assignedTo || 'Chưa phân công';
        const note = f.description ? `\nGhi chú: ${f.description}` : '';

        const title = 'KTEA CRM — Có lịch chăm sóc mới';
        const body = `Khách hàng: ${customerName}\nThời gian: ${dueFormatted}\nPhụ trách: ${assigned}${note}`;

        const payload: PushPayload = {
          title,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `new-followup-${f.id}`,
          data: {
            url: `/customers/${f.customerId}`,
            followUpId: f.id,
            customerId: f.customerId,
            eventType: 'NEW_FOLLOW_UP',
          },
        };

        // Requirement: Always send to BOTH operators: Ktea and xoaicaldez
        await this.sendToRecipients([...OPERATOR_RECIPIENTS], payload, {
          followUpId: f.id,
          eventType: 'NEW_FOLLOW_UP',
        });
      } catch (err) {
        console.error(`[WebPush] Error dispatching new follow-up notification for id=${f.id}:`, err);
      }
    }
  }

  /**
   * Background Worker / Scheduler function:
   * Checks upcoming follow-ups that need a 30-minute reminder.
   * Requirement:
   * - Trigger 30 minutes before appointment (e.g. 10:00 -> 09:30).
   * - If appointment is cancelled or completed before reminder time: do NOT send.
   * - If rescheduled: recalculates reminder time according to new due date.
   * - If created or rescheduled when reminder time has passed but appointment has not yet arrived: do NOT send an unreasonably late 30m reminder.
   * - Idempotent: Never sends duplicate reminders.
   */
  async checkAndSendDueReminders() {
    try {
      const now = new Date();
      // Target range: Appointments due between (now) and (now + 31 minutes)
      // A reminder is triggered when now >= dueAt - 30 minutes
      const maxDue = new Date(now.getTime() + 31 * 60 * 1000);

      // Find active follow-ups due soon
      const upcomingFollowUps = await prisma.followUp.findMany({
        where: {
          status: {
            in: [FollowUpStatus.PENDING, FollowUpStatus.IN_PROGRESS],
          },
          dueAt: {
            gte: now,
            lte: maxDue,
          },
        },
        include: {
          customer: {
            select: { id: true, fullName: true, phone: true },
          },
        },
      });

      if (upcomingFollowUps.length === 0) {
        return { processed: 0 };
      }

      let processedCount = 0;

      for (const item of upcomingFollowUps) {
        const dueDate = new Date(item.dueAt);
        const minutesUntilDue = (dueDate.getTime() - now.getTime()) / (60 * 1000);

        // Safety rule: Reminder is for around 30 minutes before appointment (between 0 and 31 minutes).
        // If created or updated when time remaining is already less than 15 minutes,
        // and created recently (< 15 mins ago), sending a "Còn 30 phút" is illogical and late.
        const createdAt = new Date(item.createdAt);
        const createdRecentlyMins = (now.getTime() - createdAt.getTime()) / (60 * 1000);
        if (minutesUntilDue < 15 && createdRecentlyMins < 15) {
          // Skip illogical late 30-min reminder for last-minute scheduled tasks,
          // mark as processed so it doesn't stay unhandled
          for (const recipient of OPERATOR_RECIPIENTS) {
            await prisma.pushNotificationLog.upsert({
              where: {
                followUpId_eventType_recipient: {
                  followUpId: item.id,
                  eventType: 'REMINDER_30M',
                  recipient,
                },
              },
              create: {
                followUpId: item.id,
                eventType: 'REMINDER_30M',
                recipient,
                status: 'SENT',
                title: 'Bỏ qua nhắc 30p do lịch tạo cận giờ',
                errorMessage: 'Lịch tạo sát giờ (<15p), bỏ qua nhắc 30p',
              },
              update: {},
            });
          }
          continue;
        }

        const dueFormatted = this.formatDateTimeVN(dueDate);
        const customerName = item.customer?.fullName || 'Khách hàng';
        const assigned = item.assignedTo || 'Chưa phân công';
        const note = item.description ? `\nGhi chú: ${item.description}` : '';

        const title = 'KTEA CRM — Nhắc lịch chăm sóc (còn 30 phút)';
        const body = `Sắp đến giờ hẹn: ${customerName}\nThời gian: ${dueFormatted}\nPhụ trách: ${assigned}${note}`;

        const payload: PushPayload = {
          title,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `reminder-30m-${item.id}`,
          data: {
            url: `/customers/${item.customerId}`,
            followUpId: item.id,
            customerId: item.customerId,
            eventType: 'REMINDER_30M',
          },
        };

        // Dispatches to both operators
        await this.sendToRecipients([...OPERATOR_RECIPIENTS], payload, {
          followUpId: item.id,
          eventType: 'REMINDER_30M',
        });

        processedCount++;
      }

      return { processed: processedCount };
    } catch (err) {
      console.error('[WebPush] Error checking and sending due reminders:', err);
      return { processed: 0, error: String(err) };
    }
  }

  /**
   * Send test notification to verify a recipient's devices
   */
  async sendTestNotification(recipient: string, passkey: string) {
    if (!this.verifyPasskey(passkey)) {
      throw new UnauthorizedError('Mã kích hoạt không chính xác');
    }

    const payload: PushPayload = {
      title: 'KTEA CRM — Thông báo thử nghiệm',
      body: `Hệ thống Web Push đang hoạt động ổn định trên thiết bị của ${recipient}! (${this.formatDateTimeVN(new Date())})`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `test-push-${Date.now()}`,
      data: {
        url: '/settings',
        eventType: 'TEST',
      },
    };

    return this.sendToRecipients([recipient], payload);
  }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
